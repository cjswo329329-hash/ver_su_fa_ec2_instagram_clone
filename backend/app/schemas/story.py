from datetime import datetime
from typing import List
from pydantic import BaseModel, computed_field
from app.schemas.user import UserSimple

class StoryCreate(BaseModel):
    media_url: str
    media_type: str = "image"

class StoryItemResponse(BaseModel):
    id: int
    media_url: str
    media_type: str = "image"
    expires_at: datetime
    created_at: datetime
    is_viewed: bool = False

    @computed_field
    @property
    def mediaUrl(self) -> str:
        return self.media_url

    @computed_field
    @property
    def mediaType(self) -> str:
        return self.media_type

    @computed_field
    @property
    def isViewed(self) -> bool:
        return self.is_viewed

    class Config:
        from_attributes = True

class UserStoryTrayItem(BaseModel):
    user: UserSimple
    has_unseen: bool = True
    stories_count: int = 1
    latest_story_time: datetime
    stories: List[StoryItemResponse] = []

    @computed_field
    @property
    def hasUnseen(self) -> bool:
        return self.has_unseen

    @computed_field
    @property
    def storiesCount(self) -> int:
        return self.stories_count

    class Config:
        from_attributes = True

