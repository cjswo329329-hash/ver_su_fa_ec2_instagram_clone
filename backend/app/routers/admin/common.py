import os
from typing import Optional
from fastapi import Request
from sqlalchemy.orm import Session
from app.config import settings
from app.models.user import User
from app.models.audit_log import AdminAuditLog

def delete_physical_media_file(url: Optional[str]):
    """로컬 업로드 미디어 파일 물리적 삭제 (스토리지 고아 객체 누적 방지)"""
    if not url:
        return
    try:
        if "/uploads/" in url:
            parts = url.split("/uploads/")
            if len(parts) > 1:
                rel_path = parts[1].split("?")[0]
                full_path = os.path.join(settings.UPLOAD_DIR, rel_path.replace("/", os.sep))
                if os.path.exists(full_path):
                    os.remove(full_path)
    except Exception as e:
        print(f"[WARN] 물리 파일 삭제 실패: {url}, 오류: {e}")

def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_type: str,
    target_id: Optional[int] = None,
    target_identifier: Optional[str] = None,
    reason: Optional[str] = None,
    request: Optional[Request] = None
):
    """관리자 행위 감사 로그 기록 (Audit Logging)"""
    client_ip = request.client.host if (request and request.client) else None
    audit = AdminAuditLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_identifier=target_identifier,
        reason=reason,
        ip_address=client_ip
    )
    db.add(audit)
    db.commit()

def safe_invalidate_explore():
    """탐색(Explore) 피드 캐시 안전 무효화"""
    try:
        from app.routers.explore import invalidate_explore_cache
        invalidate_explore_cache()
    except Exception:
        pass
