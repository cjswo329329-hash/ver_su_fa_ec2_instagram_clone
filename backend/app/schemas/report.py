from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ReportCreate(BaseModel):
    target_type: str  # post, reel, user, comment
    target_id: int
    reason: str  # spam, nudity, violence, harassment, hate_speech, copyright, other
    details: Optional[str] = None

class ReportResolverInfo(BaseModel):
    id: int
    username: str
    model_config = ConfigDict(from_attributes=True)

class ReportReporterInfo(BaseModel):
    id: int
    username: str
    profile_image_url: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class ReportItem(BaseModel):
    id: int
    reporter_id: int
    reporter: Optional[ReportReporterInfo] = None
    target_type: str
    target_id: int
    target_preview: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: str
    resolved_by_id: Optional[int] = None
    resolver: Optional[ReportResolverInfo] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ReportsResponse(BaseModel):
    items: List[ReportItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class ReportResolveRequest(BaseModel):
    status: str  # resolved, dismissed
    action: Optional[str] = None  # none, delete_content, suspend_user
    resolution_notes: Optional[str] = None
