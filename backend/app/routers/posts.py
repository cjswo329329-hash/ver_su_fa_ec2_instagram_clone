from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models.post import Post, PostMedia
from app.models.reel import Reel
from app.models.user import User
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.content_view import ContentView
from app.schemas.post import PostResponse, PostCreate, PostUpdate, MediaResponse, CommentSimple
from app.schemas.user import UserSimple
from app.schemas.common import PaginatedResponse
from app.core.deps import get_current_user, get_optional_current_user
from app.core.utils import format_time_ago
from app.services.notification_service import send_notification, cancel_notification
from app.routers.explore import invalidate_explore_cache

router = APIRouter(prefix="/posts", tags=["Posts"])

# 재사용 가능한 Post Eager Loading 옵션 세트 (N+1 쿼리 원천 방지)
POST_EAGER_OPTIONS = (
    joinedload(Post.author),
    selectinload(Post.media),
    selectinload(Post.likes),
    selectinload(Post.bookmarks),
    selectinload(Post.comments).joinedload(Comment.author),
)

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

    # 1. 로그인 사용자 (기획서 3단계 우선순위 & Seen Filter 적용)
    if current_user:
        # [Seen Filter] 이미 완독(completed=True 또는 3초 이상 체류)한 게시물 ID 서브쿼리
        viewed_subquery = db.query(ContentView.post_id).filter(
            ContentView.user_id == current_user.id,
            ContentView.post_id.isnot(None),
            (ContentView.completed == True) | (ContentView.duration_ms >= 3000)
        )

        following_rows = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id,
            Follow.status == "accepted"
        ).all()
        following_author_ids = {f[0] for f in following_rows}
        target_user_ids = following_author_ids | {current_user.id}

        # [1순위] 내 최근 미시청 글 & [2순위] 팔로잉 친구들의 미시청 글
        if target_user_ids:
            query = db.query(Post).options(*POST_EAGER_OPTIONS).filter(
                Post.user_id.in_(target_user_ids),
                Post.id.notin_(viewed_subquery)
            )
            if cursor:
                query = query.filter(Post.id < cursor)

            posts = query.order_by(Post.id.desc()).limit(limit + 1).all()
            if posts:
                has_more = len(posts) > limit
                returned_posts = posts[:limit]
                next_cursor = returned_posts[-1].id if has_more and returned_posts else None

        # [3순위] 확인하지 않은 친구 게시물이 없거나 소진된 경우: 개인화 AI 추천 공개 미시청 글 (무한 연속성)
        if not returned_posts:
            from app.services.recommendation_service import recommend_posts_for_user
            rec_posts, rec_has_more, rec_next_cursor = recommend_posts_for_user(
                db=db,
                user_id=current_user.id,
                limit=limit,
                cursor=cursor,
                exclude_ids=target_user_ids,
                following_ids=following_author_ids
            )
            returned_posts = rec_posts
            has_more = rec_has_more
            next_cursor = rec_next_cursor

    # 2. 비로그인 게스트 사용자: 전체 공개 계정 최신순 노출
    else:
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
    from app.services.recommendation_service import recommend_posts_for_user
    following_author_ids = set()
    user_id = current_user.id if current_user else None
    if current_user:
        f_rows = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id,
            Follow.status == "accepted"
        ).all()
        following_author_ids = {r[0] for r in f_rows}

    posts, _, _ = recommend_posts_for_user(
        db=db,
        user_id=user_id,
        limit=limit,
        cursor=None,
        exclude_ids=None,
        following_ids=following_author_ids
    )
    return [serialize_post(p, current_user, db=None, following_ids=following_author_ids) for p in posts]

def check_post_access(post: Post, user: Optional[User], db: Session) -> bool:
    """비공개 계정 게시물의 인가 여부 검증 (작성자 본인 또는 accepted 팔로워)"""
    if not post.author or not post.author.is_private:
        return True
    if not user:
        return False
    if user.id == post.user_id:
        return True
    follow = db.query(Follow).filter(
        Follow.follower_id == user.id,
        Follow.following_id == post.user_id,
        Follow.status == "accepted"
    ).first()
    return bool(follow)

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
    if not check_post_access(post, current_user, db):
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
        # Fallback: 클라이언트가 릴스 ID를 보낸 경우 릴스 좋아요로 안전하게 자동 처리
        reel = db.query(Reel).filter(Reel.id == post_id).first()
        if reel:
            existing_reel_like = db.query(Like).filter(Like.reel_id == post_id, Like.user_id == current_user.id).first()
            if existing_reel_like:
                db.delete(existing_reel_like)
                cancel_notification(db, recipient_id=reel.user_id, sender_id=current_user.id, notif_type="like_reel", target_id=post_id)
                db.commit()
                db.refresh(reel)
                invalidate_explore_cache()
                return {"liked": False, "likes_count": len(reel.likes)}
            else:
                new_reel_like = Like(reel_id=post_id, user_id=current_user.id)
                db.add(new_reel_like)
                send_notification(db, recipient_id=reel.user_id, sender_id=current_user.id, notif_type="like_reel", target_id=post_id)
                db.commit()
                db.refresh(reel)
                invalidate_explore_cache()
                try:
                    from app.services.recommendation_service import invalidate_taste_profile
                    invalidate_taste_profile(current_user.id)
                except Exception:
                    pass
                return {"liked": True, "likes_count": len(reel.likes)}
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")

    if not check_post_access(post, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비공개 계정의 게시물에는 상호작용할 수 없습니다.")
    
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        # 좋아요 알림 취소 (공통 서비스 계층)
        cancel_notification(db, recipient_id=post.user_id, sender_id=current_user.id, notif_type="like_post", target_id=post_id)
        db.commit()
        db.refresh(post)
        invalidate_explore_cache()
        return {"liked": False, "likes_count": len(post.likes)}
    else:
        new_like = Like(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        # 상대방 게시물일 경우 알림 생성 (공통 서비스 계층)
        send_notification(db, recipient_id=post.user_id, sender_id=current_user.id, notif_type="like_post", target_id=post_id)
        db.commit()
        db.refresh(post)
        invalidate_explore_cache()
        try:
            from app.services.recommendation_service import invalidate_taste_profile
            invalidate_taste_profile(current_user.id)
        except Exception:
            pass
        return {"liked": True, "likes_count": len(post.likes)}

@router.post("/{post_id}/bookmarks")
def toggle_post_bookmark(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        # Fallback: 클라이언트가 릴스 ID를 보낸 경우 릴스 북마크로 처리
        reel = db.query(Reel).filter(Reel.id == post_id).first()
        if reel:
            existing_reel_bm = db.query(Bookmark).filter(Bookmark.reel_id == post_id, Bookmark.user_id == current_user.id).first()
            if existing_reel_bm:
                db.delete(existing_reel_bm)
                db.commit()
                invalidate_explore_cache()
                return {"bookmarked": False}
            else:
                new_reel_bm = Bookmark(reel_id=post_id, user_id=current_user.id)
                db.add(new_reel_bm)
                db.commit()
                invalidate_explore_cache()
                return {"bookmarked": True}
        raise HTTPException(status_code=404, detail="게시물 또는 릴스를 찾을 수 없습니다.")

    if not check_post_access(post, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비공개 계정의 게시물은 저장할 수 없습니다.")

    existing_bookmark = db.query(Bookmark).filter(Bookmark.post_id == post_id, Bookmark.user_id == current_user.id).first()
    if existing_bookmark:
        db.delete(existing_bookmark)
        db.commit()
        invalidate_explore_cache()
        try:
            from app.services.recommendation_service import invalidate_taste_profile
            invalidate_taste_profile(current_user.id)
        except Exception:
            pass
        return {"bookmarked": False}
    else:
        new_bookmark = Bookmark(post_id=post_id, user_id=current_user.id)
        db.add(new_bookmark)
        db.commit()
        invalidate_explore_cache()
        try:
            from app.services.recommendation_service import invalidate_taste_profile
            invalidate_taste_profile(current_user.id)
        except Exception:
            pass
        return {"bookmarked": True}
