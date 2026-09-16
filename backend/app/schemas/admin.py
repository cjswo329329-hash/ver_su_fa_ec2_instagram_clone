from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AdminSummaryStats(BaseModel):
    total_users: int
    new_users_today: int
    new_users_this_week: int
    total_posts: int
    new_posts_today: int
    total_reels: int
    total_comments: int
    total_likes: int

class DateCount(BaseModel):
    date: str
    count: int

class TopUserItem(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    posts_count: int
    followers_count: int

class AdminSystemHealth(BaseModel):
    db_type: str
    status: str
    active_database: str
    is_cloud_db: bool
    server_time: str

class AdminStatsResponse(BaseModel):
    summary: AdminSummaryStats
    user_registration_trend: List[DateCount]
    post_creation_trend: List[DateCount]
    top_users: List[TopUserItem]
    system_health: Optional[AdminSystemHealth] = None

class AdminUserItem(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    is_admin: bool = False
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    is_verified: bool = False
    is_private: bool = False
    created_at: datetime
    posts_count: int = 0
    followers_count: int = 0
    following_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class AdminUsersResponse(BaseModel):
    items: List[AdminUserItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class AdminPostAuthor(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AdminPostItem(BaseModel):
    id: int
    user_id: int
    author: AdminPostAuthor
    caption: Optional[str] = None
    location: Optional[str] = None
    media_urls: List[str] = []
    media_type: str = "image"
    likes_count: int = 0
    comments_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminPostsResponse(BaseModel):
    items: List[AdminPostItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class AdminReelAuthor(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AdminReelItem(BaseModel):
    id: int
    user_id: int
    author: AdminReelAuthor
    video_url: str
    poster_url: Optional[str] = None
    caption: Optional[str] = None
    audio_title: str
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminReelsResponse(BaseModel):
    items: List[AdminReelItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class SuspendUserRequest(BaseModel):
    reason: Optional[str] = "운영 정책 위반으로 인한 이용 정지"

class BulkDeletePostsRequest(BaseModel):
    post_ids: List[int]

class BulkDeleteReelsRequest(BaseModel):
    reel_ids: List[int]

class BulkSuspendUsersRequest(BaseModel):
    user_ids: List[int]
    reason: Optional[str] = "운영 정책 위반으로 인한 일괄 이용 정지"

class AdminAuditLogItem(BaseModel):
    id: int
    admin_id: int
    admin_username: str
    action: str
    target_type: str
    target_id: Optional[int] = None
    target_identifier: Optional[str] = None
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AdminAuditLogsResponse(BaseModel):
    items: List[AdminAuditLogItem]
    total: int
    page: int
    page_size: int
    total_pages: int


