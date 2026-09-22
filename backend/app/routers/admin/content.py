from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.models.reel import Reel
from app.models.comment import Comment
from app.models.like import Like
from app.models.notification import Notification
from app.schemas.admin import (
    AdminPostsResponse,
    AdminPostItem,
    AdminPostAuthor,
    AdminReelsResponse,
    AdminReelItem,
    AdminReelAuthor,
    BulkDeletePostsRequest,
    BulkDeleteReelsRequest,
)
from app.routers.admin.common import (
    delete_physical_media_file,
    log_admin_action,
    safe_invalidate_explore,
)

router = APIRouter()

# =========================================================================
# 게시물 (Posts) 관리
# =========================================================================
@router.get("/posts", response_model=AdminPostsResponse)
def get_admin_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    q: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("created_at_desc", pattern="^(created_at_desc|created_at_asc|likes_desc|comments_desc)$"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    if not isinstance(page, int):
        page = 1
    if not isinstance(page_size, int):
        page_size = 15
    if not isinstance(sort_by, str):
        sort_by = "created_at_desc"

    post_filter = []
    has_q = bool(isinstance(q, str) and q.strip())
    if has_q:
        search_term = f"%{q.strip()}%"
        post_filter.append(
            (Post.caption.ilike(search_term)) |
            (User.username.ilike(search_term))
        )

    if has_q:
        total = (
            db.query(func.count(Post.id))
            .join(User, Post.user_id == User.id)
            .filter(*post_filter)
            .scalar() or 0
        )
    else:
        total = db.query(func.count(Post.id)).scalar() or 0

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    base_query = (
        db.query(Post)
        .join(User, Post.user_id == User.id)
        .options(joinedload(Post.author), selectinload(Post.media))
        .filter(*post_filter)
    )

    if sort_by == "created_at_asc":
        posts = base_query.order_by(asc(Post.created_at), asc(Post.id)).offset(offset).limit(page_size).all()
    elif sort_by == "likes_desc":
        like_cnt_subq = (
            db.query(Like.post_id, func.count(Like.id).label("likes_count"))
            .filter(Like.post_id.isnot(None))
            .group_by(Like.post_id)
            .subquery()
        )
        posts = (
            base_query
            .outerjoin(like_cnt_subq, Post.id == like_cnt_subq.c.post_id)
            .order_by(desc(func.coalesce(like_cnt_subq.c.likes_count, 0)), desc(Post.created_at), desc(Post.id))
            .offset(offset)
            .limit(page_size)
            .all()
        )
    elif sort_by == "comments_desc":
        comment_cnt_subq = (
            db.query(Comment.post_id, func.count(Comment.id).label("comments_count"))
            .filter(Comment.post_id.isnot(None))
            .group_by(Comment.post_id)
            .subquery()
        )
        posts = (
            base_query
            .outerjoin(comment_cnt_subq, Post.id == comment_cnt_subq.c.post_id)
            .order_by(desc(func.coalesce(comment_cnt_subq.c.comments_count, 0)), desc(Post.created_at), desc(Post.id))
            .offset(offset)
            .limit(page_size)
            .all()
        )
    else:  # created_at_desc
        posts = base_query.order_by(desc(Post.created_at), desc(Post.id)).offset(offset).limit(page_size).all()

    post_ids = [p.id for p in posts]
    like_counts = {}
    comment_counts = {}

    if post_ids:
        l_rows = (
            db.query(Like.post_id, func.count(Like.id))
            .filter(Like.post_id.in_(post_ids))
            .group_by(Like.post_id)
            .all()
        )
        like_counts = dict(l_rows)

        c_rows = (
            db.query(Comment.post_id, func.count(Comment.id))
            .filter(Comment.post_id.in_(post_ids))
            .group_by(Comment.post_id)
            .all()
        )
        comment_counts = dict(c_rows)

    items = []
    for p in posts:
        items.append(
            AdminPostItem(
                id=p.id,
                user_id=p.user_id,
                author=AdminPostAuthor(
                    id=p.author.id,
                    username=p.author.username,
                    full_name=p.author.full_name,
                    profile_image_url=p.author.profile_image_url
                ) if p.author else AdminPostAuthor(id=0, username="unknown"),
                caption=p.caption,
                location=p.location,
                media_urls=[m.media_url for m in p.media] if p.media else [],
                media_type=p.media[0].media_type if p.media else "image",
                likes_count=like_counts.get(p.id, 0),
                comments_count=comment_counts.get(p.id, 0),
                created_at=p.created_at
            )
        )

    return AdminPostsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.delete("/posts/{post_id}")
def delete_post_by_admin(
    post_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """게시물 강제 삭제"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="삭제할 게시물을 찾을 수 없습니다.")

    caption_snippet = (post.caption[:50] + "...") if post.caption else f"ID #{post.id}"
    try:
        for m in post.media:
            delete_physical_media_file(m.media_url)

        db.query(Notification).filter(
            (Notification.target_id == post_id) &
            (Notification.type.in_(["like_post", "comment_post", "comment"]))
        ).delete(synchronize_session=False)

        db.delete(post)
        db.commit()

        safe_invalidate_explore()
        log_admin_action(
            db, admin_user, "DELETE_POST", "post", post_id, caption_snippet,
            "관리자 권한 강제 삭제", request
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"게시물 삭제 중 오류 발생: {str(e)}")

    return {"message": f"게시물 (ID: {post_id})이 관리자 권한으로 삭제되었습니다."}

@router.post("/posts/bulk-delete")
def bulk_delete_posts(
    bulk_data: BulkDeletePostsRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """게시물 일괄 삭제 (Bulk Delete)"""
    count = 0
    for pid in bulk_data.post_ids:
        p = db.query(Post).filter(Post.id == pid).first()
        if p:
            for m in p.media:
                delete_physical_media_file(m.media_url)
            db.delete(p)
            count += 1

    db.commit()
    safe_invalidate_explore()
    log_admin_action(
        db, admin_user, "BULK_DELETE_POSTS", "post", None, f"count:{count}",
        f"{count}개 게시물 일괄 삭제", request
    )
    return {"message": f"총 {count}개의 게시물이 일괄 삭제되었습니다."}


# =========================================================================
# 릴스 (Reels) 관리
# =========================================================================
@router.get("/reels", response_model=AdminReelsResponse)
def get_admin_reels(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    q: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("created_at_desc", pattern="^(created_at_desc|created_at_asc|likes_desc|comments_desc|shares_desc)$"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    if not isinstance(page, int):
        page = 1
    if not isinstance(page_size, int):
        page_size = 15
    if not isinstance(sort_by, str):
        sort_by = "created_at_desc"

    reel_filter = []
    has_q = bool(isinstance(q, str) and q.strip())
    if has_q:
        search_term = f"%{q.strip()}%"
        reel_filter.append(
            (Reel.caption.ilike(search_term)) |
            (User.username.ilike(search_term)) |
            (Reel.audio_title.ilike(search_term))
        )

    if has_q:
        total = (
            db.query(func.count(Reel.id))
            .join(User, Reel.user_id == User.id)
            .filter(*reel_filter)
            .scalar() or 0
        )
    else:
        total = db.query(func.count(Reel.id)).scalar() or 0

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    base_query = (
        db.query(Reel)
        .join(User, Reel.user_id == User.id)
        .options(joinedload(Reel.author))
        .filter(*reel_filter)
    )

    if sort_by == "created_at_asc":
        reels = base_query.order_by(asc(Reel.created_at), asc(Reel.id)).offset(offset).limit(page_size).all()
    elif sort_by == "shares_desc":
        reels = base_query.order_by(desc(Reel.shares_count), desc(Reel.created_at), desc(Reel.id)).offset(offset).limit(page_size).all()
    elif sort_by == "likes_desc":
        like_cnt_subq = (
            db.query(Like.reel_id, func.count(Like.id).label("likes_count"))
            .filter(Like.reel_id.isnot(None))
            .group_by(Like.reel_id)
            .subquery()
        )
        reels = (
            base_query
            .outerjoin(like_cnt_subq, Reel.id == like_cnt_subq.c.reel_id)
            .order_by(desc(func.coalesce(like_cnt_subq.c.likes_count, 0)), desc(Reel.created_at), desc(Reel.id))
            .offset(offset)
            .limit(page_size)
            .all()
        )
    elif sort_by == "comments_desc":
        comment_cnt_subq = (
            db.query(Comment.reel_id, func.count(Comment.id).label("comments_count"))
            .filter(Comment.reel_id.isnot(None))
            .group_by(Comment.reel_id)
            .subquery()
        )
        reels = (
            base_query
            .outerjoin(comment_cnt_subq, Reel.id == comment_cnt_subq.c.reel_id)
            .order_by(desc(func.coalesce(comment_cnt_subq.c.comments_count, 0)), desc(Reel.created_at), desc(Reel.id))
            .offset(offset)
            .limit(page_size)
            .all()
        )
    else:  # created_at_desc
        reels = base_query.order_by(desc(Reel.created_at), desc(Reel.id)).offset(offset).limit(page_size).all()

    reel_ids = [r.id for r in reels]
    like_counts = {}
    comment_counts = {}

    if reel_ids:
        l_rows = (
            db.query(Like.reel_id, func.count(Like.id))
            .filter(Like.reel_id.in_(reel_ids))
            .group_by(Like.reel_id)
            .all()
        )
        like_counts = dict(l_rows)

        c_rows = (
            db.query(Comment.reel_id, func.count(Comment.id))
            .filter(Comment.reel_id.in_(reel_ids))
            .group_by(Comment.reel_id)
            .all()
        )
        comment_counts = dict(c_rows)

    items = [
        AdminReelItem(
            id=r.id,
            user_id=r.user_id,
            author=AdminReelAuthor(
                id=r.author.id,
                username=r.author.username,
                full_name=r.author.full_name,
                profile_image_url=r.author.profile_image_url
            ) if r.author else AdminReelAuthor(id=0, username="unknown"),
            video_url=r.video_url,
            poster_url=r.poster_url,
            caption=r.caption,
            audio_title=r.audio_title,
            likes_count=like_counts.get(r.id, 0),
            comments_count=comment_counts.get(r.id, 0),
            shares_count=r.shares_count,
            created_at=r.created_at
        )
        for r in reels
    ]

    return AdminReelsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.delete("/reels/{reel_id}")
def delete_reel_by_admin(
    reel_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """릴스 동영상 강제 삭제"""
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        raise HTTPException(status_code=404, detail="삭제할 릴스를 찾을 수 없습니다.")

    caption_snippet = (reel.caption[:50] + "...") if reel.caption else f"ID #{reel.id}"
    try:
        delete_physical_media_file(reel.video_url)
        delete_physical_media_file(reel.poster_url)

        db.query(Notification).filter(
            (Notification.target_id == reel_id) &
            (Notification.type.in_(["like_reel", "comment_reel"]))
        ).delete(synchronize_session=False)

        db.delete(reel)
        db.commit()

        safe_invalidate_explore()
        log_admin_action(
            db, admin_user, "DELETE_REEL", "reel", reel_id, caption_snippet,
            "관리자 권한 강제 삭제", request
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"릴스 삭제 중 오류 발생: {str(e)}")

    return {"message": f"릴스 (ID: {reel_id})이 관리자 권한으로 삭제되었습니다."}

@router.post("/reels/bulk-delete")
def bulk_delete_reels(
    bulk_data: BulkDeleteReelsRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """릴스 일괄 삭제 (Bulk Delete)"""
    count = 0
    for rid in bulk_data.reel_ids:
        r = db.query(Reel).filter(Reel.id == rid).first()
        if r:
            delete_physical_media_file(r.video_url)
            delete_physical_media_file(r.poster_url)
            db.delete(r)
            count += 1

    db.commit()
    safe_invalidate_explore()
    log_admin_action(
        db, admin_user, "BULK_DELETE_REELS", "reel", None, f"count:{count}",
        f"{count}개 릴스 일괄 삭제", request
    )
    return {"message": f"총 {count}개의 릴스가 일괄 삭제되었습니다."}
