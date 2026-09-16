from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.posts import router as posts_router
from app.routers.comments import router as comments_router
from app.routers.reels import router as reels_router
from app.routers.explore import router as explore_router
from app.routers.direct import router as direct_router
from app.routers.stories import router as stories_router
from app.routers.bookmarks import router as bookmarks_router
from app.routers.follows import router as follows_router
from app.routers.notifications import router as notifications_router
from app.routers.uploads import router as uploads_router
from app.routers.admin import router as admin_router
from app.routers.views import router as views_router
from app.routers.reports import router as reports_router

__all__ = [
    "auth_router",
    "users_router",
    "posts_router",
    "comments_router",
    "reels_router",
    "explore_router",
    "direct_router",
    "stories_router",
    "bookmarks_router",
    "follows_router",
    "notifications_router",
    "uploads_router",
    "admin_router",
    "views_router",
    "reports_router",
]
