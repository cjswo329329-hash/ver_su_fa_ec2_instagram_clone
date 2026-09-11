from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ContentViewCreate(BaseModel):
    post_id: Optional[int] = Field(None, serialization_alias="postId")
    reel_id: Optional[int] = Field(None, serialization_alias="reelId")
    duration_ms: int = Field(0, serialization_alias="durationMs", ge=0, description="체류 시간 (밀리초, 1초=1,000ms)")
    watch_ratio: float = Field(0.0, serialization_alias="watchRatio", ge=0.0, description="시청 비율 (0.0~N.N, 1.0=100% 완주)")
    completed: bool = Field(False, description="콘텐츠 완독/완주시청 여부")
    not_interested: bool = Field(False, serialization_alias="notInterested", description="관심 없음 명시적 피드백 여부")
    source: Optional[str] = Field("feed", description="노출 소스 (feed, reels, explore, profile)")

    class Config:
        populate_by_name = True

class ContentViewResponse(BaseModel):
    id: int
    user_id: int = Field(..., serialization_alias="userId")
    post_id: Optional[int] = Field(None, serialization_alias="postId")
    reel_id: Optional[int] = Field(None, serialization_alias="reelId")
    duration_ms: int = Field(..., serialization_alias="durationMs")
    watch_ratio: float = Field(..., serialization_alias="watchRatio")
    completed: bool
    not_interested: bool = Field(..., serialization_alias="notInterested")
    source: Optional[str]
    created_at: datetime = Field(..., serialization_alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True
