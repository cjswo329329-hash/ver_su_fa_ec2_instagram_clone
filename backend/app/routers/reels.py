from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models.reel import Reel
from app.models.user import User
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.notification import Notification
from app.models.content_view import ContentView
from app.schemas.reel import (
    ReelResponse, ReelCreate, ReelAuthor, ReelAudio, ReelComment
)
from app.schemas.comment import CommentCreate, CommentResponse, CommentReplyResponse
from app.core.deps import get_current_user, get_optional_current_user
from app.routers.posts import format_time_ago

router = APIRouter(prefix="/reels", tags=["Reels"])

def serialize_reel(reel: Reel, current_user: Optional[User] = None, db: Optional[Session] = None) -> ReelResponse:
    is_liked = False
    is_bookmarked = False
    is_following = False

    if current_user:
        is_liked = any(like.user_id == current_user.id for like in reel.likes)
        is_bookmarked = any(b.user_id == current_user.id for b in reel.bookmarks)
        if db and reel.user_id != current_user.id:
            follow = db.query(Follow).filter(
                Follow.follower_id == current_user.id,
                Follow.following_id == reel.user_id
            ).first()
            is_following = bool(follow)

    author = ReelAuthor(
        id=reel.author.id,
        username=reel.author.username,
        full_name=reel.author.full_name,
        profile_image_url=reel.author.profile_image_url,
        is_verified=reel.author.is_verified,
        is_following=is_following
    )

    audio = ReelAudio(
        title=reel.audio_title,
        is_explicit=reel.audio_is_explicit,
        cover_url=reel.audio_cover_url
    )

    recent_comments = [
        ReelComment(
            id=c.id,
            username=c.author.username,
            profile_image_url=c.author.profile_image_url,
            text=c.content,
            time_ago=format_time_ago(c.created_at),
            likes=len(c.likes)
        )
        for c in reel.comments[-10:]
    ]

    video_url = reel.video_url
    if not video_url or "mixkit" in video_url or "test.mp4" in video_url:
        video_url = f"/videos/reel{((reel.id - 1) % 160) + 1}.mp4"

    return ReelResponse(
        id=reel.id,
        video_url=video_url,
        poster_url=reel.poster_url,
        author=author,
        tagged_user=reel.tagged_user,
        caption=reel.caption,
        category=reel.category,
        duration_ms=reel.duration_ms if reel.duration_ms else 15000,
        audio=audio,
        likes_count=len(reel.likes),
        is_liked=is_liked,
        comments_count=len(reel.comments),
        shares_count=reel.shares_count,
        reposts_count=reel.reposts_count,
        is_bookmarked=is_bookmarked,
        comments=recent_comments,
        created_at=reel.created_at
    )

def _normalize_video_url(raw_url: Optional[str], reel_id: int) -> str:
    if not raw_url or "mixkit" in raw_url or "test.mp4" in raw_url:
        return f"/videos/reel{((reel_id - 1) % 160) + 1}.mp4"
    return raw_url

def _generate_cycle(reels_meta: list, seed: int, last_video: Optional[str] = None, last_id: Optional[int] = None) -> list:
    import random
    from collections import defaultdict

    rng = random.Random(seed)
    buckets = defaultdict(list)
    for r in reels_meta:
        buckets[r[2]].append(r)
    for v in buckets.values():
        rng.shuffle(v)

    result = []
    prev_vid = last_video
    prev_user = None
    prev_id = last_id

    while any(buckets.values()):
        candidates = [vid for vid, items in buckets.items() if items and vid != prev_vid]
        if not candidates:
            candidates = [vid for vid, items in buckets.items() if items]
        candidates.sort(key=lambda vid: (len(buckets[vid]), rng.random()), reverse=True)
        chosen_vid = candidates[0]

        items = buckets[chosen_vid]
        best_idx = 0
        for idx, item in enumerate(items):
            if item[0] != prev_id and item[1] != prev_user:
                best_idx = idx
                break

        item = items.pop(best_idx)
        result.append(item)
        prev_vid = item[2]
        prev_user = item[1]
        prev_id = item[0]

    return result

def _get_stream_slice(reels_meta: list, seed: int, offset: int, limit: int) -> list:
    N = len(reels_meta)
    if N == 0:
        return []
    start_cycle = offset // N
    end_cycle = (offset + limit - 1) // N

    all_items = []
    last_vid = None
    last_id = None
    for c in range(end_cycle + 1):
        c_seed = (seed * 10007 + c * 9973) % 2147483647
        cycle_items = _generate_cycle(reels_meta, c_seed, last_video=last_vid, last_id=last_id)
        last_vid = cycle_items[-1][2]
        last_id = cycle_items[-1][0]
        if c >= start_cycle:
            all_items.extend(cycle_items)

    cycle_offset = offset - (start_cycle * N)
    return all_items[cycle_offset : cycle_offset + limit]

@router.get("", response_model=List[ReelResponse])
def get_reels(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    seed: Optional[int] = Query(None, description="Random seed for consistent shuffle"),
    exclude_ids: Optional[str] = Query(None, description="Comma-separated IDs already seen in this session"),
    cursor: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # 1. 제외할 릴스 ID 세트 (세션 exclude_ids + 로그인 계정의 시청 이력)
    client_excluded = set()
    if exclude_ids:
        try:
            client_excluded = {int(x.strip()) for x in exclude_ids.split(",") if x.strip().isdigit()}
        except Exception:
            client_excluded = set()

    user_viewed_ids = set()
    if current_user:
        view_rows = db.query(ContentView.reel_id).filter(
            ContentView.user_id == current_user.id,
            ContentView.reel_id.isnot(None)
        ).distinct().all()
        user_viewed_ids = {r[0] for r in view_rows if r[0]}

    all_excluded = client_excluded | user_viewed_ids

    # 2. 전체 릴스 메타데이터 조회
    raw_meta = db.query(Reel.id, Reel.user_id, Reel.video_url).order_by(Reel.id.asc()).all()
    if not raw_meta:
        return []

    # 3. 미시청 릴스 우선 선별 (계정 기준 무중복 규칙)
    unseen_meta = [r for r in raw_meta if r[0] not in all_excluded]

    # 모든 릴스를 다 시청한 경우: 현재 화면에 떠 있는 ID만 제외하고 풀 리셋
    if len(unseen_meta) < limit:
        candidate_meta = [r for r in raw_meta if r[0] not in client_excluded]
        if not candidate_meta:
            candidate_meta = raw_meta
    else:
        candidate_meta = unseen_meta

    reels_meta = [(r[0], r[1], _normalize_video_url(r[2], r[0])) for r in candidate_meta]

    if seed is not None:
        page_items = _get_stream_slice(reels_meta, seed=seed, offset=offset, limit=limit)
    else:
        page_items = reels_meta[offset : offset + limit]

    if not page_items:
        return []

    page_ids = [item[0] for item in page_items]
    reels_query = (
        db.query(Reel)
        .options(
            joinedload(Reel.author),
            selectinload(Reel.likes),
            selectinload(Reel.bookmarks),
            selectinload(Reel.comments).joinedload(Comment.author),
        )
        .filter(Reel.id.in_(set(page_ids)))
    )
    reels_map = {r.id: r for r in reels_query.all()}
    reels = [reels_map[rid] for rid in page_ids if rid in reels_map]

    return [serialize_reel(r, current_user, db) for r in reels]

@router.post("", response_model=ReelResponse)
def create_reel(
    reel_in: ReelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = Reel(
        user_id=current_user.id,
        video_url=reel_in.video_url,
        poster_url=reel_in.poster_url,
        caption=reel_in.caption,
        category=reel_in.category,
        duration_ms=reel_in.duration_ms if reel_in.duration_ms else 15000,
        tagged_user=reel_in.tagged_user,
        audio_title=reel_in.audio_title,
        audio_cover_url=reel_in.audio_cover_url,
        audio_is_explicit=reel_in.audio_is_explicit
    )
    db.add(reel)
    db.commit()
    db.refresh(reel)

    return serialize_reel(reel, current_user, db)

@router.post("/{reel_id}/likes")
def toggle_reel_like(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    existing_like = db.query(Like).filter(Like.reel_id == reel_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        # 릴스 좋아요 알림 취소
        db.query(Notification).filter(
            Notification.recipient_id == reel.user_id,
            Notification.sender_id == current_user.id,
            Notification.type == "like_reel",
            Notification.target_id == reel_id
        ).delete()
        db.commit()
        db.refresh(reel)
        return {"liked": False, "likes_count": len(reel.likes)}
    else:
        new_like = Like(reel_id=reel_id, user_id=current_user.id)
        db.add(new_like)
        # 상대방 릴스일 경우 알림 발송
        if reel.user_id != current_user.id:
            notif = Notification(
                recipient_id=reel.user_id,
                sender_id=current_user.id,
                type="like_reel",
                target_id=reel_id
            )
            db.add(notif)
        db.commit()
        db.refresh(reel)
        return {"liked": True, "likes_count": len(reel.likes)}

@router.post("/{reel_id}/bookmarks")
def toggle_reel_bookmark(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    existing_bookmark = db.query(Bookmark).filter(Bookmark.reel_id == reel_id, Bookmark.user_id == current_user.id).first()
    if existing_bookmark:
        db.delete(existing_bookmark)
        db.commit()
        return {"bookmarked": False}
    else:
        new_bookmark = Bookmark(reel_id=reel_id, user_id=current_user.id)
        db.add(new_bookmark)
        db.commit()
        return {"bookmarked": True}

@router.get("/{reel_id}/comments", response_model=List[CommentResponse])
def get_reel_comments(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    root_comments = db.query(Comment).filter(
        Comment.reel_id == reel_id,
        Comment.parent_id.is_(None)
    ).order_by(Comment.created_at.asc()).all()

    replies_all = db.query(Comment).filter(
        Comment.reel_id == reel_id,
        Comment.parent_id.isnot(None)
    ).order_by(Comment.created_at.asc()).all()

    replies_map = {}
    for r in replies_all:
        if r.parent_id not in replies_map:
            replies_map[r.parent_id] = []
        is_liked = False
        if current_user:
            is_liked = any(like.user_id == current_user.id for like in r.likes)
        replies_map[r.parent_id].append(
            CommentReplyResponse(
                id=r.id,
                post_id=r.post_id,
                reel_id=r.reel_id,
                parent_id=r.parent_id,
                content=r.content,
                created_at=r.created_at,
                author=r.author,
                likes_count=len(r.likes),
                is_liked=is_liked
            )
        )

    results = []
    for c in root_comments:
        is_liked = False
        if current_user:
            is_liked = any(like.user_id == current_user.id for like in c.likes)
        c_replies = replies_map.get(c.id, [])
        results.append(
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                reel_id=c.reel_id,
                parent_id=c.parent_id,
                content=c.content,
                created_at=c.created_at,
                author=c.author,
                likes_count=len(c.likes),
                is_liked=is_liked,
                replies=c_replies,
                replies_count=len(c_replies)
            )
        )
    return results

@router.post("/{reel_id}/comments", response_model=CommentResponse)
def add_reel_comment(
    reel_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    parent_comment = None
    if comment_in.parent_id:
        parent_comment = db.query(Comment).filter(
            Comment.id == comment_in.parent_id,
            Comment.reel_id == reel_id
        ).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="부모 댓글을 찾을 수 없습니다.")

    comment = Comment(
        reel_id=reel_id,
        user_id=current_user.id,
        content=comment_in.content,
        parent_id=comment_in.parent_id
    )
    db.add(comment)

    # 상대방 릴스 또는 부모 댓글 작성자에게 알림 발송
    recipient_id = parent_comment.user_id if parent_comment else reel.user_id
    if recipient_id != current_user.id:
        notif = Notification(
            recipient_id=recipient_id,
            sender_id=current_user.id,
            type="comment",
            target_id=reel_id
        )
        db.add(notif)

    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        reel_id=comment.reel_id,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        author=current_user,
        likes_count=0,
        is_liked=False,
        replies=[],
        replies_count=0
    )

@router.post("/{reel_id}/share")
def share_reel(
    reel_id: int,
    db: Session = Depends(get_db)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    reel.shares_count += 1
    db.commit()
    return {"shares_count": reel.shares_count}

@router.post("/{reel_id}/repost")
def repost_reel(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    reel.reposts_count += 1
    db.commit()
    return {"reposts_count": reel.reposts_count}
