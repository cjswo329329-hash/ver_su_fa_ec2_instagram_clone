from fastapi import APIRouter, Depends
from app.core.deps import get_current_admin_user

from app.routers.admin.common import (
    delete_physical_media_file,
    log_admin_action,
    safe_invalidate_explore,
)
from app.routers.admin.stats import router as stats_router, get_admin_statistics
from app.routers.admin.users import (
    router as users_router,
    get_admin_users,
    suspend_user_by_admin,
    unsuspend_user_by_admin,
    bulk_suspend_users,
    delete_user_by_admin,
)
from app.routers.admin.content import (
    router as content_router,
    get_admin_posts,
    delete_post_by_admin,
    bulk_delete_posts,
    get_admin_reels,
    delete_reel_by_admin,
    bulk_delete_reels,
)
from app.routers.admin.audit import router as audit_router, get_admin_audit_logs

# 단일 책임 원칙(SRP)에 따라 도메인별 분할된 서브 라우터 통합
router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(get_current_admin_user)])

router.include_router(stats_router)
router.include_router(users_router)
router.include_router(content_router)
router.include_router(audit_router)

__all__ = [
    "router",
    "delete_physical_media_file",
    "log_admin_action",
    "safe_invalidate_explore",
    "get_admin_statistics",
    "get_admin_users",
    "suspend_user_by_admin",
    "unsuspend_user_by_admin",
    "bulk_suspend_users",
    "delete_user_by_admin",
    "get_admin_posts",
    "delete_post_by_admin",
    "bulk_delete_posts",
    "get_admin_reels",
    "delete_reel_by_admin",
    "bulk_delete_reels",
    "get_admin_audit_logs",
]
