from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_admin_user
from app.models.user import User
from app.models.audit_log import AdminAuditLog
from app.schemas.admin import (
    AdminAuditLogsResponse,
    AdminAuditLogItem,
)

router = APIRouter()

@router.get("/audit-logs", response_model=AdminAuditLogsResponse)
def get_admin_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    """
    관리자 행위 감사 로그 조회 (페이징, 액션 필터)
    """
    query = db.query(AdminAuditLog)
    if action and action.strip():
        query = query.filter(AdminAuditLog.action == action.strip())

    total = query.count()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    logs = (
        query.order_by(desc(AdminAuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        AdminAuditLogItem(
            id=log.id,
            admin_id=log.admin_id,
            admin_username=log.admin_username,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            target_identifier=log.target_identifier,
            reason=log.reason,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return AdminAuditLogsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
