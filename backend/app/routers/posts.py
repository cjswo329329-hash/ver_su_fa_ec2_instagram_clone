from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models.post import Post, PostMedia
from app.models.user import User
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.follow import Follow
from app.schemas.post import PostResponse, PostCreate, PostUpdate, MediaResponse, CommentSimple
from app.schemas.user import UserSimple
from app.schemas.common import PaginatedResponse
from app.core.deps import get_current_user, get_optional_current_user

router = APIRouter(prefix="/posts", tags=["Posts"])

# 재사용 가능한 Post Eager Loading 옵션 세트 (N+1 쿼리 원천 방지)
POST_EAGER_OPTIONS = (
    joinedload(Post.author),
    selectinload(Post.media),
    selectinload(Post.likes),
    selectinload(Post.bookmarks),
    selectinload(Post.comments).joinedload(Comment.author),
)

def format_time_ago(dt: datetime) -> str:
    now = datetime.utcnow()
    diff = now - dt
    seconds = diff.total_seconds()
    if seconds < 60:
        return "방금 전"
    minutes = seconds // 60
    if minutes < 60:
        return f"{int(minutes)}분 전"
    hours = minutes // 60
    if hours < 24:
        return f"{int(hours)}시간 전"
    days = hours // 24
    if days < 7:
        return f"{int(days)}일 전"
    weeks = days // 7
    if weeks < 52:
        return f"{int(weeks)}주 전"
    return f"{int(days // 365)}년 전"

def serialize_post(
    post: Post,
    current_user: Optional[User] = None,
    db: Optional[Session] = None,
    following_ids: Optional[set] = None
) -> PostResponse:
    is_liked = False
    is_bookmarked = False
    if current_user:
        is_liked = any(like.user_id == current_user.id for like in post.likes)
        is_bookmarked = any(b.user_id == current_user.id for b in post.bookmarks)

    author_is_following = False
    if current_user and post.user_id != current_user.id:
        if following_ids is not None:
            author_is_following = post.user_id in following_ids
        elif db:
            follow = db.query(Follow).filter(
                Follow.follower_id == current_user.id,
                Follow.following_id == post.user_id,
                Follow.status == "accepted"
            ).first()
            author_is_following = bool(follow)

    author_data = UserSimple(
        id=post.author.id,
        username=post.author.username,
        full_name=post.author.full_name,
        profile_image_url=post.author.profile_image_url,
        is_verified=post.author.is_verified,
        is_admin=post.author.is_admin,
        is_following=author_is_following
    )

    top_comments = [
        CommentSimple(
            id=c.id,
            username=c.author.username,
            content=c.content,
            created_at=c.created_at
        )
        for c in post.comments[-2:]
    ]

    return PostResponse(
        id=post.id,
        caption=post.caption,
        location=post.location,
        category=post.category,
        created_at=post.created_at,
        time_ago=format_time_ago(post.created_at),
        author=author_data,
        media=[
            MediaResponse(
                id=m.id,
                media_url=m.media_url,
                media_type=m.media_type,
                order_index=m.order_index
            )
            for m in post.media
        ],
        likes_count=len(post.likes),
        comments_count=len(post.comments),
        is_liked=is_liked,
        is_bookmarked=is_bookmarked,
        top_comments=top_comments
    )

@router.get("/feed", response_model=PaginatedResponse[PostResponse])
def get_feed(
    limit: int = Query(10, ge=1, le=50),
    cursor: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    returned_posts = []
    has_more = False
    next_cursor = None
    following_author_ids = set()

    # 1. 로그인 사용자이고 팔로우한 유저가 있는 경우: 팔로우한 유저 + 본인 게시물 조회
    if current_user:
        following_rows = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id,
            Follow.status == "accepted"
        ).all()
        following_author_ids = {f[0] for f in following_rows}

        if following_author_ids:
            target_user_ids = following_author_ids | {current_user.id}
            query = db.query(Post).options(*POST_EAGER_OPTIONS).filter(Post.user_id.in_(target_user_ids))
            if cursor:
                query = query.filter(Post.id < cursor)

            posts = query.order_by(Post.id.desc()).limit(limit + 1).all()

            has_more = len(posts) > limit
            returned_posts = posts[:limit]
            next_cursor = returned_posts[-1].id if has_more and returned_posts else None

    # 2. 비로그인 사용자 또는 팔로우한 사람이 아직 없거나(게시물 없는 경우도 포함): 전체 공개 게시물 최신순
    if not returned_posts:
        query = db.query(Post).options(*POST_EAGER_OPTIONS).join(User, Post.user_id == User.id).filter(
            User.is_private == False
        )

        if cursor:
            query = query.filter(Post.id < cursor)

        posts = query.order_by(Post.id.desc()).limit(limit + 1).all()
        has_more = len(posts) > limit
        returned_posts = posts[:limit]
        next_cursor = returned_posts[-1].id if has_more and returned_posts else None

    items = [serialize_post(p, current_user, db=None, following_ids=following_author_ids) for p in returned_posts]
    return PaginatedResponse(items=items, next_cursor=next_cursor, has_more=has_more)

@router.get("/explore", response_model=List[PostResponse])
def get_explore_posts(
    limit: int = Query(18, ge=1, le=60),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    posts = db.query(Post).options(*POST_EAGER_OPTIONS).order_by(Post.id.desc()).limit(limit).all()
    following_author_ids = set()
    if current_user and posts:
        author_ids = {p.user_id for p in posts if p.user_id != current_user.id}
        if author_ids:
            f_rows = db.query(Follow.following_id).filter(
                Follow.follower_id == current_user.id,
                Follow.following_id.in_(author_ids),
                Follow.status == "accepted"
            ).all()
            following_author_ids = {r[0] for r in f_rows}
    return [serialize_post(p, current_user, db=None, following_ids=following_author_ids) for p in posts]

@router.get("/{post_id}", response_model=PostResponse)
def get_post_detail(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    post = db.query(Post).options(*POST_EAGER_OPTIONS).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")

    # 비공개 계정 게시물 접근 제어
    if post.author and post.author.is_private:
        is_allowed = False
        if current_user:
            if current_user.id == post.user_id:
                is_allowed = True
            else:
                follow = db.query(Follow).filter(
                    Follow.follower_id == current_user.id,
                    Follow.following_id == post.user_id,
                    Follow.status == "accepted"
                ).first()
                if follow:
                    is_allowed = True
        if not is_allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비공개 계정의 게시물입니다.")

    return serialize_post(post, current_user, db)

@router.post("", response_model=PostResponse)
def create_post(
    post_in: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not post_in.media_urls:
        raise HTTPException(status_code=400, detail="최소 1개 이상의 미디어가 필요합니다.")

    post = Post(
        user_id=current_user.id,
        caption=post_in.caption,
        location=post_in.location,
        category=post_in.category
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    video_exts = (".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv")
    for idx, url in enumerate(post_in.media_urls):
        is_video = any(url.lower().endswith(vext) for vext in video_exts)
        media = PostMedia(
            post_id=post.id,
            media_url=url,
            media_type="video" if is_video else "image",
            order_index=idx
        )
        db.add(media)
    db.commit()
    db.refresh(post)

    try:
        from app.routers.explore import invalidate_explore_cache
        invalidate_explore_cache()
    except Exception:
        pass

    return serialize_post(post, current_user, db)

@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="작성자 또는 관리자만 삭제할 수 있습니다.")
    db.delete(post)
    db.commit()

    try:
        from app.routers.explore import invalidate_explore_cache
        invalidate_explore_cache()
    except Exception:
        pass

    return {"message": "게시물이 삭제되었습니다."}

@router.post("/{post_id}/likes")
def toggle_post_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")
    
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        # 좋아요 알림 취소
        db.query(Notification).filter(
            Notification.recipient_id == post.user_id,
            Notification.sender_id == current_user.id,
            Notification.type == "like_post",
            Notification.target_id == post_id
        ).delete()
        db.commit()
        db.refresh(post)
        return {"liked": False, "likes_count": len(post.likes)}
    else:
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        # 상대방 게시물일 경우 알림 생성
        if post.user_id != current_user.id:
            notif = Notification(
                recipient_id=post.user_id,
                sender_id=current_user.id,
                type="like_post",
                target_id=post_id
            )
            db.add(notif)
        db.commit()
        db.refresh(post)
        return {"liked": True, "likes_count": len(post.likes)}

@router.post("/{post_id}/bookmarks")
def toggle_post_bookmark(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")

    existing_bookmark = db.query(Bookmark).filter(Bookmark.post_id == post_id, Bookmark.user_id == current_user.id).first()
    if existing_bookmark:
        db.delete(existing_bookmark)
        db.commit()
        return {"bookmarked": False}
    else:
        new_bookmark = Bookmark(post_id=post_id, user_id=current_user.id)
        db.add(new_bookmark)
        db.commit()
        return {"bookmarked": True}
