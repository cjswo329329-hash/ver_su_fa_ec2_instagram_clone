import time
from typing import List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_
from app.database import get_db
from app.models.post import Post
from app.models.reel import Reel
from app.models.user import User
from app.schemas.explore import ExploreItemResponse
from app.schemas.user import UserSimple

router = APIRouter(prefix="/explore", tags=["Explore"])

# Explore 전용 Eager Loading 옵션 (155회 쿼리를 6회 이하로 축소)
POST_EXPLORE_OPTIONS = (
    joinedload(Post.author),
    selectinload(Post.media),
    selectinload(Post.likes),
    selectinload(Post.comments),
)

REEL_EXPLORE_OPTIONS = (
    joinedload(Reel.author),
    selectinload(Reel.likes),
    selectinload(Reel.comments),
)

# In-memory TTL 캐시 (탐색 피드 빠른 연속 스크롤 시 0.001초 응답 보장)
_explore_cache: Dict[str, Tuple[float, List[ExploreItemResponse]]] = {}
EXPLORE_CACHE_TTL = 30.0  # 30초 유효

def invalidate_explore_cache():
    global _explore_cache
    _explore_cache.clear()

@router.get("", response_model=List[ExploreItemResponse])
def get_explore(
    q: Optional[str] = Query(None, description="검색 키워드"),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    # 1. 캐시 검사 (검색어가 없는 일반 탐색 스크롤 요청 시)
    is_search = bool(q and q.strip())
    cache_key = f"exp_{offset}_{limit}"
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
        post_items.append(
            ExploreItemResponse(
                id=p.id,
                title=title,
                media_url=media_url,
                is_video=False,
                likes_count=len(p.likes),
                comments_count=len(p.comments),
                author=author_data,
                caption=p.caption
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
        reel_items.append(
            ExploreItemResponse(
                id=r.id,
                title=title,
                media_url=media_url,
                is_video=True,
                likes_count=len(r.likes),
                comments_count=len(r.comments),
                author=author_data,
                caption=r.caption
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
