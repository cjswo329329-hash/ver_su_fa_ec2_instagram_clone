from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.database import get_db, is_sqlite
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.models.reel import Reel
from app.models.comment import Comment
from app.models.like import Like
from app.models.follow import Follow
from app.schemas.admin import (
    AdminStatsResponse,
    AdminSummaryStats,
    AdminSystemHealth,
    DateCount,
    TopUserItem,
)

router = APIRouter()

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_statistics(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    통계 대시보드 데이터 조회 (N+1 제거 및 단일 SQL 서브쿼리 집계)
    """
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

    # 2. 최근 14일 일별 추이
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

    # 3. 상위 활동 회원 TOP 5
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

    # 시스템 헬스 상태
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
