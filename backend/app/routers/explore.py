import time
from typing import List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_
from app.database import get_db
from app.models.post import Post
from app.models.reel import Reel
from app.models.user import User
from app.models.comment import Comment
from app.schemas.explore import ExploreItemResponse
from app.schemas.user import UserSimple
from app.schemas.comment import CommentResponse, CommentReplyResponse
from app.core.deps import get_optional_current_user

router = APIRouter(prefix="/explore", tags=["Explore"])

# Explore 전용 Eager Loading 옵션 (댓글 및 작성자, 좋아요 즉시 포함)
POST_EXPLORE_OPTIONS = (
    joinedload(Post.author),
    selectinload(Post.media),
    selectinload(Post.likes),
    selectinload(Post.bookmarks),
    selectinload(Post.comments).joinedload(Comment.author),
    selectinload(Post.comments).selectinload(Comment.likes),
)

REEL_EXPLORE_OPTIONS = (
    joinedload(Reel.author),
    selectinload(Reel.likes),
    selectinload(Reel.bookmarks),
    selectinload(Reel.comments).joinedload(Comment.author),
    selectinload(Reel.comments).selectinload(Comment.likes),
)

def _format_item_comments(comments_list, current_user_id: Optional[int] = None) -> List[CommentResponse]:
    """탐색 아이템에 포함할 댓글 및 대댓글 트리 고속 포매터"""
    if not comments_list:
        return []
    root_comments = []
    replies_map = {}
    for c in comments_list:
        is_liked = False
        if current_user_id:
            is_liked = any(like.user_id == current_user_id for like in c.likes)
        if c.parent_id is None:
            root_comments.append(c)
        else:
            if c.parent_id not in replies_map:
                replies_map[c.parent_id] = []
            author_data = UserSimple(
                id=c.author.id,
                username=c.author.username,
                full_name=c.author.full_name,
                profile_image_url=c.author.profile_image_url,
                is_verified=c.author.is_verified,
                is_admin=c.author.is_admin,
                is_private=c.author.is_private
            ) if c.author else None
            replies_map[c.parent_id].append(
                CommentReplyResponse(
                    id=c.id,
                    post_id=c.post_id,
                    reel_id=c.reel_id,
                    parent_id=c.parent_id,
                    content=c.content,
                    created_at=c.created_at,
                    author=author_data,
                    likes_count=len(c.likes),
                    is_liked=is_liked
                )
            )

    results = []
    for c in root_comments:
        is_liked = False
        if current_user_id:
            is_liked = any(like.user_id == current_user_id for like in c.likes)
        c_replies = replies_map.get(c.id, [])
        author_data = UserSimple(
            id=c.author.id,
            username=c.author.username,
            full_name=c.author.full_name,
            profile_image_url=c.author.profile_image_url,
            is_verified=c.author.is_verified,
            is_admin=c.author.is_admin,
            is_private=c.author.is_private
        ) if c.author else None
        results.append(
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                reel_id=c.reel_id,
                parent_id=c.parent_id,
                content=c.content,
                created_at=c.created_at,
                author=author_data,
                likes_count=len(c.likes),
                is_liked=is_liked,
                replies=c_replies,
                replies_count=len(c_replies)
            )
        )
    return results

# In-memory TTL 캐시 (탐색 피드 빠른 연속 스크롤 시 0.001초 응답 보장)
_explore_cache: Dict[str, Tuple[float, List[ExploreItemResponse]]] = {}
EXPLORE_CACHE_TTL = 15.0  # 15초 유효

def invalidate_explore_cache():
    global _explore_cache
    _explore_cache.clear()

@router.get("", response_model=List[ExploreItemResponse])
def get_explore(
    q: Optional[str] = Query(None, description="검색 키워드"),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # 1. 캐시 검사 (검색어가 없는 일반 탐색 스크롤 요청 시)
    is_search = bool(q and q.strip())
    uid_part = str(current_user.id) if current_user else "anon"
    cache_key = f"exp_{offset}_{limit}_{uid_part}"
    now_ts = time.time()

    if not is_search and cache_key in _explore_cache:
        cached_ts, cached_data = _explore_cache[cache_key]
        if now_ts - cached_ts < EXPLORE_CACHE_TTL:
            return cached_data

    # 2. 포스트와 릴스를 균등하게 분할 조회 (50:50 배분)
    half_limit = max(1, limit // 2)
    post_offset = offset // 2
    reel_offset = offset // 2

    post_query = (
        db.query(Post)
        .options(*POST_EXPLORE_OPTIONS)
        .join(User, Post.user_id == User.id)
        .filter(User.is_private == False)
        .order_by(Post.id.desc())
    )

    reel_query = (
        db.query(Reel)
        .options(*REEL_EXPLORE_OPTIONS)
        .join(User, Reel.user_id == User.id)
        .filter(User.is_private == False)
        .order_by(Reel.id.desc())
    )

    if is_search:
        keyword = f"%{q.strip()}%"
        post_query = post_query.filter(or_(Post.caption.ilike(keyword), Post.location.ilike(keyword)))
        reel_query = reel_query.filter(or_(Reel.caption.ilike(keyword), Reel.tagged_user.ilike(keyword), Reel.audio_title.ilike(keyword)))

    posts = post_query.offset(post_offset).limit(half_limit).all()
    reels = reel_query.offset(reel_offset).limit(half_limit).all()

    post_items: List[ExploreItemResponse] = []
    for p in posts:
        media_url = p.media[0].media_url if p.media else "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800"
        title = p.caption.split("\n")[0] if p.caption else None
        author_data = UserSimple(
            id=p.author.id,
            username=p.author.username,
            full_name=p.author.full_name,
            profile_image_url=p.author.profile_image_url,
            is_verified=p.author.is_verified,
            is_admin=p.author.is_admin,
            is_private=p.author.is_private
        )
        is_bm = any(b.user_id == current_user.id for b in p.bookmarks) if current_user else False
        is_lk = any(l.user_id == current_user.id for l in p.likes) if current_user else False
        post_comments = _format_item_comments(p.comments, current_user.id if current_user else None)
        post_items.append(
            ExploreItemResponse(
                id=p.id,
                title=title,
                media_url=media_url,
                is_video=False,
                likes_count=len(p.likes),
                comments_count=len(p.comments),
                is_bookmarked=is_bm,
                is_liked=is_lk,
                author=author_data,
                caption=p.caption,
                comments=post_comments
            )
        )

    reel_items: List[ExploreItemResponse] = []
    for r in reels:
        media_url = r.poster_url or r.video_url
        title = r.caption.split("\n")[0] if r.caption else r.audio_title
        author_data = UserSimple(
            id=r.author.id,
            username=r.author.username,
            full_name=r.author.full_name,
            profile_image_url=r.author.profile_image_url,
            is_verified=r.author.is_verified,
            is_admin=r.author.is_admin,
            is_private=r.author.is_private
        )
        is_bm = any(b.user_id == current_user.id for b in r.bookmarks) if current_user else False
        is_lk = any(l.user_id == current_user.id for l in r.likes) if current_user else False
        reel_comments = _format_item_comments(r.comments, current_user.id if current_user else None)
        reel_items.append(
            ExploreItemResponse(
                id=r.id,
                title=title,
                media_url=media_url,
                is_video=True,
                likes_count=len(r.likes),
                comments_count=len(r.comments),
                is_bookmarked=is_bm,
                is_liked=is_lk,
                author=author_data,
                caption=r.caption,
                comments=reel_comments
            )
        )

    # 3. 포스트와 릴스를 매끄럽게 교차(Interleave: 1 포스트 + 1 릴스) 배치
    results: List[ExploreItemResponse] = []
    p_idx = 0
    r_idx = 0
    while p_idx < len(post_items) or r_idx < len(reel_items):
        if p_idx < len(post_items):
            results.append(post_items[p_idx])
            p_idx += 1
        if r_idx < len(reel_items):
            results.append(reel_items[r_idx])
            r_idx += 1

    final_results = results[:limit]

    # 4. 캐시 저장 (비검색 시)
    if not is_search:
        if len(_explore_cache) > 50:
            _explore_cache.clear()
        _explore_cache[cache_key] = (now_ts, final_results)

    return final_results
