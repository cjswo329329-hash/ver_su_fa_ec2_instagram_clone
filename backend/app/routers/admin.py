import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, desc, asc, case
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db, is_sqlite
from app.config import settings
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.post import Post, PostMedia
from app.models.reel import Reel
from app.models.comment import Comment
from app.models.like import Like
from app.models.follow import Follow
from app.models.notification import Notification
from app.models.direct import Conversation, Message
from app.models.audit_log import AdminAuditLog
from app.schemas.admin import (
    AdminStatsResponse,
    AdminSummaryStats,
    AdminSystemHealth,
    DateCount,
    TopUserItem,
    AdminUsersResponse,
    AdminUserItem,
    AdminPostsResponse,
    AdminPostItem,
    AdminPostAuthor,
    AdminReelsResponse,
    AdminReelItem,
    AdminReelAuthor,
    SuspendUserRequest,
    BulkDeletePostsRequest,
    BulkDeleteReelsRequest,
    BulkSuspendUsersRequest,
    AdminAuditLogsResponse,
    AdminAuditLogItem,
)

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(get_current_admin_user)])

def delete_physical_media_file(url: Optional[str]):
    """로컬 업로드 미디어 파일 물리적 삭제 (스토리지 고아 객체 누적 방지)"""
    if not url:
        return
    try:
        if "/uploads/" in url:
            # 예: /uploads/posts/abc.jpg 또는 http://.../uploads/posts/abc.jpg
            parts = url.split("/uploads/")
            if len(parts) > 1:
                rel_path = parts[1].split("?")[0]
                full_path = os.path.join(settings.UPLOAD_DIR, rel_path.replace("/", os.sep))
                if os.path.exists(full_path):
                    os.remove(full_path)
    except Exception as e:
        print(f"[WARN] 물리 파일 삭제 실패: {url}, 오류: {e}")

def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_type: str,
    target_id: Optional[int] = None,
    target_identifier: Optional[str] = None,
    reason: Optional[str] = None,
    request: Optional[Request] = None
):
    """관리자 행위 감사 로그 기록 (Audit Logging)"""
    client_ip = request.client.host if (request and request.client) else None
    audit = AdminAuditLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_identifier=target_identifier,
        reason=reason,
        ip_address=client_ip
    )
    db.add(audit)
    db.commit()

def safe_invalidate_explore():
    try:
        from app.routers.explore import invalidate_explore_cache
        invalidate_explore_cache()
    except Exception:
        pass


# =========================================================================
# 1. 대시보드 통계 API (대용량 최적화 SQL 집계)
# =========================================================================
@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_statistics(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    통계 대시보드 데이터 조회 (N+1 제거 및 단일 SQL 서브쿼리 집계)
    """
    # KST (UTC+9) 기준 날짜 경계 계산
    kst_tz = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst_tz)
    today_kst_start = datetime(now_kst.year, now_kst.month, now_kst.day, tzinfo=kst_tz)
    today_start_utc = today_kst_start.astimezone(timezone.utc).replace(tzinfo=None)
    week_start_utc = today_start_utc - timedelta(days=7)
    fourteen_days_utc = today_start_utc - timedelta(days=13)

    # 1. 요약 지표 카운트
    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users_today = db.query(func.count(User.id)).filter(User.created_at >= today_start_utc).scalar() or 0
    new_users_this_week = db.query(func.count(User.id)).filter(User.created_at >= week_start_utc).scalar() or 0

    total_posts = db.query(func.count(Post.id)).scalar() or 0
    new_posts_today = db.query(func.count(Post.id)).filter(Post.created_at >= today_start_utc).scalar() or 0
    total_reels = db.query(func.count(Reel.id)).scalar() or 0
    total_comments = db.query(func.count(Comment.id)).scalar() or 0
    total_likes = db.query(func.count(Like.id)).scalar() or 0

    summary = AdminSummaryStats(
        total_users=total_users,
        new_users_today=new_users_today,
        new_users_this_week=new_users_this_week,
        total_posts=total_posts,
        new_posts_today=new_posts_today,
        total_reels=total_reels,
        total_comments=total_comments,
        total_likes=total_likes,
    )

    # 2. 최근 14일 일별 추이 (단 2번의 GROUP BY 집계 쿼리로 28회 루프 쿼리 제거)
    user_counts_raw = (
        db.query(func.date(User.created_at).label("d"), func.count(User.id).label("cnt"))
        .filter(User.created_at >= fourteen_days_utc)
        .group_by(func.date(User.created_at))
        .all()
    )
    user_counts_map = {str(r.d): r.cnt for r in user_counts_raw}

    post_counts_raw = (
        db.query(func.date(Post.created_at).label("d"), func.count(Post.id).label("cnt"))
        .filter(Post.created_at >= fourteen_days_utc)
        .group_by(func.date(Post.created_at))
        .all()
    )
    post_counts_map = {str(r.d): r.cnt for r in post_counts_raw}

    user_trend: List[DateCount] = []
    post_trend: List[DateCount] = []

    for i in range(13, -1, -1):
        target_day = (now_kst - timedelta(days=i)).date()
        date_iso = target_day.strftime("%Y-%m-%d")
        display_str = target_day.strftime("%m-%d")

        u_cnt = user_counts_map.get(date_iso, 0)
        p_cnt = post_counts_map.get(date_iso, 0)

        user_trend.append(DateCount(date=display_str, count=u_cnt))
        post_trend.append(DateCount(date=display_str, count=p_cnt))

    # 3. 상위 활동 회원 TOP 5 (SQL 집계 서브쿼리로 전체 User 메모리 로드 제거)
    post_cnt_subq = (
        db.query(Post.user_id, func.count(Post.id).label("p_cnt"))
        .group_by(Post.user_id)
        .subquery()
    )
    follower_cnt_subq = (
        db.query(Follow.following_id, func.count(Follow.id).label("f_cnt"))
        .filter(Follow.status == "accepted")
        .group_by(Follow.following_id)
        .subquery()
    )

    top_user_rows = (
        db.query(
            User.id,
            User.username,
            User.full_name,
            User.profile_image_url,
            func.coalesce(post_cnt_subq.c.p_cnt, 0).label("posts_count"),
            func.coalesce(follower_cnt_subq.c.f_cnt, 0).label("followers_count"),
        )
        .outerjoin(post_cnt_subq, User.id == post_cnt_subq.c.user_id)
        .outerjoin(follower_cnt_subq, User.id == follower_cnt_subq.c.following_id)
        .filter(User.is_admin == False)
        .order_by(desc("posts_count"), desc("followers_count"))
        .limit(5)
        .all()
    )

    top_users = [
        TopUserItem(
            id=r.id,
            username=r.username,
            full_name=r.full_name,
            profile_image_url=r.profile_image_url,
            posts_count=r.posts_count,
            followers_count=r.followers_count,
        )
        for r in top_user_rows
    ]

    # 시스템 헬스 상태 (동적 환경 진단)
    system_health = AdminSystemHealth(
        db_type="SQLite (Local WAL Mode)" if is_sqlite else "PostgreSQL (Supabase Cloud)",
        status="정상 가동 중 (Healthy)",
        active_database="sqlite://instagram.db" if is_sqlite else "Supabase Managed PostgreSQL",
        is_cloud_db=not is_sqlite,
        server_time=now_kst.strftime("%Y-%m-%d %H:%M:%S KST")
    )

    return AdminStatsResponse(
        summary=summary,
        user_registration_trend=user_trend,
        post_creation_trend=post_trend,
        top_users=top_users,
        system_health=system_health
    )


# =========================================================================
# 2. 회원 관리 API (DB 레벨 정렬, 페이징 및 정지/해제)
# =========================================================================
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

    # 1. Total 카운트 (불필요한 서브쿼리 조인 없이 단일 카운트로 초고속 처리)
    total = db.query(func.count(User.id)).filter(*user_filter).scalar() or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    # 2. 페이징 대상 조회
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

    # 3. 페이징된 사용자에 대해서만 배치 집계 (IN 절)
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
    """
    회원 계정 정지 (Suspension)
    """
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
    """
    회원 계정 정지 해제
    """
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
    """
    회원 일괄 계정 정지
    """
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
    """
    회원 강제 탈퇴 / 계정 삭제
    - 보안: 관리자 본인 및 타 관리자 삭제 절대 차단
    - 무결성: 연관 물리 미디어 파일 정리 및 감사 로그
    """
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="관리자 본인 계정은 탈퇴/삭제할 수 없습니다.")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 회원을 찾을 수 없습니다.")

    if target_user.is_admin:
        raise HTTPException(status_code=400, detail="다른 관리자 계정은 삭제할 수 없습니다.")

    username_cached = target_user.username

    try:
        # 물리 미디어 파일 정리 (프로필, 게시물 미디어)
        delete_physical_media_file(target_user.profile_image_url)
        for post in target_user.posts:
            for m in post.media:
                delete_physical_media_file(m.media_url)
        for reel in target_user.reels:
            delete_physical_media_file(reel.video_url)
            delete_physical_media_file(reel.poster_url)

        # 연관 알림 및 메시지 삭제
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


# =========================================================================
# 3. 게시물 관리 API (DB 레벨 집계 및 일괄 삭제)
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

    # 1. Total 카운트 (무거운 서브쿼리 조인 없이 초고속 단일 카운트)
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

    # 2. 페이징 대상 조회 (author, media eager-loading으로 N+1 제거)
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

    # 3. 페이징된 15개 게시물에 대해서만 IN 절 배치 집계
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
    """
    게시물 강제 삭제
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="삭제할 게시물을 찾을 수 없습니다.")

    caption_snippet = (post.caption[:50] + "...") if post.caption else f"ID #{post.id}"
    try:
        # 물리 파일 삭제
        for m in post.media:
            delete_physical_media_file(m.media_url)

        db.query(Notification).filter(
            (Notification.target_id == post_id) &
            (Notification.type.in_(["like_post", "comment"]))
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
    """
    게시물 일괄 삭제 (Bulk Delete)
    """
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
# 4. 릴스 관리 API (DB 레벨 집계 및 일괄 삭제)
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

    # 1. Total 카운트 (무거운 서브쿼리 조인 없이 초고속 단일 카운트)
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

    # 2. 페이징 대상 조회 (author eager-loading으로 N+1 제거)
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

    # 3. 페이징된 15개 릴스에 대해서만 IN 절 배치 집계
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
    """
    릴스 동영상 강제 삭제
    """
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
    """
    릴스 일괄 삭제 (Bulk Delete)
    """
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


# =========================================================================
# 5. 감사 로그 API (Audit Log Viewer)
# =========================================================================
@router.get("/audit-logs", response_model=AdminAuditLogsResponse)
def get_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    관리자 행위 감사 로그 조회 (페이징, 액션 필터)
    """
    query = db.query(AdminAuditLog)
    if action and action.strip():
        query = query.filter(AdminAuditLog.action == action.strip())

    total = query.count()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    logs = (
        query.order_by(desc(AdminAuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        AdminAuditLogItem(
            id=log.id,
            admin_id=log.admin_id,
            admin_username=log.admin_username,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            target_identifier=log.target_identifier,
            reason=log.reason,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return AdminAuditLogsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
