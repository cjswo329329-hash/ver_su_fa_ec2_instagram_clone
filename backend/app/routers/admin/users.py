from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, desc, asc
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.models.follow import Follow
from app.models.notification import Notification
from app.models.direct import Conversation, Message
from app.schemas.admin import (
    AdminUsersResponse,
    AdminUserItem,
    SuspendUserRequest,
    BulkSuspendUsersRequest,
)
from app.routers.admin.common import (
    delete_physical_media_file,
    log_admin_action,
    safe_invalidate_explore,
)

router = APIRouter()

@router.get("/users", response_model=AdminUsersResponse)
def get_admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    q: Optional[str] = Query(None, max_length=100),
    sort_by: str = Query("created_at_desc", pattern="^(created_at_desc|created_at_asc|posts_desc|followers_desc)$"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    if not isinstance(page, int):
        page = 1
    if not isinstance(page_size, int):
        page_size = 15
    if not isinstance(sort_by, str):
        sort_by = "created_at_desc"

    user_filter = []
    if isinstance(q, str) and q.strip():
        search_term = f"%{q.strip()}%"
        user_filter.append(
            (User.username.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.full_name.ilike(search_term))
        )

    total = db.query(func.count(User.id)).filter(*user_filter).scalar() or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    if sort_by == "created_at_asc":
        user_query = db.query(User).filter(*user_filter).order_by(asc(User.created_at), asc(User.id))
        users = user_query.offset(offset).limit(page_size).all()
    elif sort_by == "posts_desc":
        post_cnt_subq = (
            db.query(Post.user_id, func.count(Post.id).label("posts_count"))
            .group_by(Post.user_id)
            .subquery()
        )
        user_query = (
            db.query(User)
            .outerjoin(post_cnt_subq, User.id == post_cnt_subq.c.user_id)
            .filter(*user_filter)
            .order_by(desc(func.coalesce(post_cnt_subq.c.posts_count, 0)), desc(User.created_at), desc(User.id))
        )
        users = user_query.offset(offset).limit(page_size).all()
    elif sort_by == "followers_desc":
        follower_cnt_subq = (
            db.query(Follow.following_id, func.count(Follow.id).label("followers_count"))
            .filter(Follow.status == "accepted")
            .group_by(Follow.following_id)
            .subquery()
        )
        user_query = (
            db.query(User)
            .outerjoin(follower_cnt_subq, User.id == follower_cnt_subq.c.following_id)
            .filter(*user_filter)
            .order_by(desc(func.coalesce(follower_cnt_subq.c.followers_count, 0)), desc(User.created_at), desc(User.id))
        )
        users = user_query.offset(offset).limit(page_size).all()
    else:  # created_at_desc
        user_query = db.query(User).filter(*user_filter).order_by(desc(User.created_at), desc(User.id))
        users = user_query.offset(offset).limit(page_size).all()

    user_ids = [u.id for u in users]
    post_counts = {}
    follower_counts = {}
    following_counts = {}

    if user_ids:
        p_rows = (
            db.query(Post.user_id, func.count(Post.id))
            .filter(Post.user_id.in_(user_ids))
            .group_by(Post.user_id)
            .all()
        )
        post_counts = dict(p_rows)

        f_rows = (
            db.query(Follow.following_id, func.count(Follow.id))
            .filter(Follow.following_id.in_(user_ids), Follow.status == "accepted")
            .group_by(Follow.following_id)
            .all()
        )
        follower_counts = dict(f_rows)

        fg_rows = (
            db.query(Follow.follower_id, func.count(Follow.id))
            .filter(Follow.follower_id.in_(user_ids), Follow.status == "accepted")
            .group_by(Follow.follower_id)
            .all()
        )
        following_counts = dict(fg_rows)

    items = [
        AdminUserItem(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            profile_image_url=u.profile_image_url,
            is_admin=u.is_admin,
            is_suspended=getattr(u, "is_suspended", False),
            suspension_reason=getattr(u, "suspension_reason", None),
            is_verified=u.is_verified,
            is_private=u.is_private,
            created_at=u.created_at,
            posts_count=post_counts.get(u.id, 0),
            followers_count=follower_counts.get(u.id, 0),
            following_count=following_counts.get(u.id, 0),
        )
        for u in users
    ]

    return AdminUsersResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/users/{user_id}/suspend")
def suspend_user_by_admin(
    user_id: int,
    suspend_data: SuspendUserRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """회원 계정 정지 (Suspension)"""
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="관리자 본인 계정은 정지할 수 없습니다.")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 회원을 찾을 수 없습니다.")

    if target_user.is_admin:
        raise HTTPException(status_code=400, detail="다른 관리자 계정은 정지할 수 없습니다.")

    target_user.is_suspended = True
    target_user.suspension_reason = suspend_data.reason or "운영 정책 위반으로 인한 이용 정지"
    db.commit()

    log_admin_action(
        db, admin_user, "SUSPEND_USER", "user", target_user.id, target_user.username,
        target_user.suspension_reason, request
    )

    return {"message": f"회원 '@{target_user.username}' 계정이 이용 정지되었습니다."}

@router.post("/users/{user_id}/unsuspend")
def unsuspend_user_by_admin(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """회원 계정 정지 해제"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 회원을 찾을 수 없습니다.")

    target_user.is_suspended = False
    target_user.suspension_reason = None
    db.commit()

    log_admin_action(
        db, admin_user, "UNSUSPEND_USER", "user", target_user.id, target_user.username,
        "관리자에 의한 정지 해제", request
    )

    return {"message": f"회원 '@{target_user.username}' 계정 정지가 성공적으로 해제되었습니다."}

@router.post("/users/bulk-suspend")
def bulk_suspend_users(
    bulk_data: BulkSuspendUsersRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """회원 일괄 계정 정지"""
    count = 0
    for uid in bulk_data.user_ids:
        if uid == admin_user.id:
            continue
        u = db.query(User).filter(User.id == uid).first()
        if u and not u.is_admin:
            u.is_suspended = True
            u.suspension_reason = bulk_data.reason
            count += 1

    db.commit()
    log_admin_action(
        db, admin_user, "BULK_SUSPEND_USERS", "user", None, f"count:{count}",
        bulk_data.reason, request
    )
    return {"message": f"총 {count}명의 회원이 일괄 정지 처리되었습니다."}

@router.delete("/users/{user_id}")
def delete_user_by_admin(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """회원 강제 탈퇴 / 계정 삭제"""
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="관리자 본인 계정은 탈퇴/삭제할 수 없습니다.")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 회원을 찾을 수 없습니다.")

    if target_user.is_admin:
        raise HTTPException(status_code=400, detail="다른 관리자 계정은 삭제할 수 없습니다.")

    username_cached = target_user.username

    try:
        delete_physical_media_file(target_user.profile_image_url)
        for post in target_user.posts:
            for m in post.media:
                delete_physical_media_file(m.media_url)
        for reel in target_user.reels:
            delete_physical_media_file(reel.video_url)
            delete_physical_media_file(reel.poster_url)

        db.query(Notification).filter(
            (Notification.recipient_id == user_id) | (Notification.sender_id == user_id)
        ).delete(synchronize_session=False)

        db.query(Message).filter(Message.sender_id == user_id).delete(synchronize_session=False)
        db.query(Conversation).filter(
            (Conversation.user1_id == user_id) | (Conversation.user2_id == user_id)
        ).delete(synchronize_session=False)

        db.delete(target_user)
        db.commit()

        safe_invalidate_explore()
        log_admin_action(
            db, admin_user, "DELETE_USER", "user", user_id, username_cached,
            "관리자에 의한 강제 탈퇴 처리", request
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"회원 탈퇴 처리 중 오류가 발생했습니다: {str(e)}")

    return {"message": f"회원 '{username_cached}' 계정이 안전하게 탈퇴 처리되었습니다."}
