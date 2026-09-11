from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.user import UserSimple

class ReelAuthor(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = Field(None, serialization_alias="fullName")
    profile_image_url: Optional[str] = Field(None, serialization_alias="profileImageUrl")
    is_verified: bool = Field(False, serialization_alias="isVerified")
    is_following: bool = Field(False, serialization_alias="isFollowing")

    class Config:
        from_attributes = True
        populate_by_name = True

class ReelAudio(BaseModel):
    title: str
    is_explicit: bool = Field(False, serialization_alias="isExplicit")
    cover_url: Optional[str] = Field(None, serialization_alias="coverUrl")

    class Config:
        from_attributes = True
        populate_by_name = True

class ReelComment(BaseModel):
    id: int
    username: str
    profile_image_url: Optional[str] = Field(None, serialization_alias="profileImageUrl")
    text: str
    time_ago: str = Field("방금 전", serialization_alias="timeAgo")
    likes: int = 0

    class Config:
        from_attributes = True
        populate_by_name = True

class ReelResponse(BaseModel):
    id: int
    video_url: str = Field(..., serialization_alias="videoUrl")
    poster_url: Optional[str] = Field(None, serialization_alias="posterUrl")
    author: ReelAuthor
    tagged_user: Optional[str] = Field(None, serialization_alias="taggedUser")
    caption: Optional[str] = None
    category: Optional[str] = None
    duration_ms: int = Field(15000, serialization_alias="durationMs")
    audio: Optional[ReelAudio] = None
    likes_count: int = Field(0, serialization_alias="likesCount")
    is_liked: bool = Field(False, serialization_alias="isLiked")
    comments_count: int = Field(0, serialization_alias="commentsCount")
    shares_count: int = Field(0, serialization_alias="sharesCount")
    reposts_count: int = Field(0, serialization_alias="repostsCount")
    is_bookmarked: bool = Field(False, serialization_alias="isBookmarked")
    comments: List[ReelComment] = []
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True

class ReelCreate(BaseModel):
    video_url: str
    poster_url: Optional[str] = None
    caption: Optional[str] = None
    category: Optional[str] = None
    duration_ms: int = Field(15000, serialization_alias="durationMs")
    tagged_user: Optional[str] = None
    audio_title: str
    audio_cover_url: Optional[str] = None
    audio_is_explicit: bool = False
