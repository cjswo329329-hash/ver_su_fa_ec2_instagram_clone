from typing import Optional, List
from pydantic import BaseModel, computed_field
from app.schemas.user import UserSimple
from app.schemas.comment import CommentResponse

class ExploreItemResponse(BaseModel):
    id: int
    title: Optional[str] = None
    media_url: str
    is_video: bool = False
    likes_count: int = 0
    comments_count: int = 0
    is_bookmarked: bool = False
    is_liked: bool = False
    author: Optional[UserSimple] = None
    caption: Optional[str] = None
    comments: List[CommentResponse] = []

    @computed_field
    @property
    def mediaUrl(self) -> str:
        return self.media_url

    @computed_field
    @property
    def isVideo(self) -> bool:
        return self.is_video

    @computed_field
    @property
    def likesCount(self) -> int:
        return self.likes_count

    @computed_field
    @property
    def commentsCount(self) -> int:
        return self.comments_count

    @computed_field
    @property
    def isBookmarked(self) -> bool:
        return self.is_bookmarked

    @computed_field
    @property
    def isLiked(self) -> bool:
        return self.is_liked

    class Config:
        from_attributes = True
        populate_by_name = True
