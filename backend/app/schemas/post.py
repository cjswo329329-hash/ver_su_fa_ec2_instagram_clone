from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, computed_field
from app.schemas.user import UserSimple

class MediaCreate(BaseModel):
    media_url: str
    media_type: str = "image"
    order_index: int = 0

class MediaResponse(BaseModel):
    id: int
    media_url: str = Field(..., serialization_alias="mediaUrl")
    media_type: str = Field("image", serialization_alias="mediaType")
    order_index: int = Field(0, serialization_alias="orderIndex")

    class Config:
        from_attributes = True
        populate_by_name = True

class PostCreate(BaseModel):
    caption: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    media_urls: List[str]

class PostUpdate(BaseModel):
    caption: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None

class CommentSimple(BaseModel):
    id: int
    username: str
    content: str
    created_at: datetime

    @computed_field
    @property
    def text(self) -> str:
        return self.content

    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    caption: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    author: UserSimple
    media: List[MediaResponse]
    likes_count: int = Field(0, serialization_alias="likesCount")
    comments_count: int = Field(0, serialization_alias="commentsCount")
    is_liked: bool = Field(False, serialization_alias="isLiked")
    is_bookmarked: bool = Field(False, serialization_alias="isBookmarked")
    time_ago: str = Field("방금 전", serialization_alias="timeAgo")
    top_comments: List[CommentSimple] = Field([], serialization_alias="topComments")

    @computed_field
    @property
    def comments(self) -> List[CommentSimple]:
        return self.top_comments

    class Config:
        from_attributes = True
        populate_by_name = True

