from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.post import Post
from app.models.reel import Reel
from app.models.comment import Comment
from app.models.report import Report
from app.models.audit_log import AdminAuditLog
from app.schemas.report import (
    ReportCreate,
    ReportItem,
    ReportReporterInfo,
    ReportResolverInfo,
    ReportsResponse,
    ReportResolveRequest
)

router = APIRouter(tags=["Reports"])

@router.post("/reports", status_code=status.HTTP_201_CREATED)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_preview = None
    if report_in.target_type == "post":
        target = db.query(Post).filter(Post.id == report_in.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="신고 대상 게시물을 찾을 수 없습니다.")
    elif report_in.target_type == "reel":
        target = db.query(Reel).filter(Reel.id == report_in.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="신고 대상 릴스를 찾을 수 없습니다.")
    elif report_in.target_type == "user":
        target = db.query(User).filter(User.id == report_in.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="신고 대상 회원을 찾을 수 없습니다.")
        if target.id == current_user.id:
            raise HTTPException(status_code=400, detail="본인 계정은 신고할 수 없습니다.")
    elif report_in.target_type == "comment":
        target = db.query(Comment).filter(Comment.id == report_in.target_id).first()
        if not target:
            raise HTTPException(status_code=404, detail="신고 대상 댓글을 찾을 수 없습니다.")
    else:
        raise HTTPException(status_code=400, detail="유효하지 않은 신고 대상 유형입니다.")

    existing = db.query(Report).filter(
        Report.reporter_id == current_user.id,
        Report.target_type == report_in.target_type,
        Report.target_id == report_in.target_id,
        Report.status == "pending"
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 검토 중인 신고 건입니다. 관리자 검토를 기다려주세요.")

    new_report = Report(
        reporter_id=current_user.id,
        target_type=report_in.target_type,
        target_id=report_in.target_id,
        reason=report_in.reason,
        details=report_in.details,
        status="pending"
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return {"message": "신고가 정상 접수되었습니다. 검토 후 신속히 조치하겠습니다.", "report_id": new_report.id}

@router.get("/admin/reports", response_model=ReportsResponse)
def get_admin_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    query = db.query(Report)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if target_type:
        query = query.filter(Report.target_type == target_type)

    total = query.count()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    reports = query.order_by(desc(Report.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        preview = None
        if r.target_type == "post":
            p = db.query(Post).filter(Post.id == r.target_id).first()
            preview = (p.caption[:50] + "...") if (p and p.caption) else ("게시물 #" + str(r.target_id) if p else "(삭제된 게시물)")
        elif r.target_type == "reel":
            rl = db.query(Reel).filter(Reel.id == r.target_id).first()
            preview = (rl.caption[:50] + "...") if (rl and rl.caption) else ("릴스 #" + str(r.target_id) if rl else "(삭제된 릴스)")
        elif r.target_type == "user":
            u = db.query(User).filter(User.id == r.target_id).first()
            preview = f"@{u.username}" if u else "(탈퇴 회원)"
        elif r.target_type == "comment":
            c = db.query(Comment).filter(Comment.id == r.target_id).first()
            preview = (c.text[:50] + "...") if c else "(삭제된 댓글)"

        items.append(
            ReportItem(
                id=r.id,
                reporter_id=r.reporter_id,
                reporter=ReportReporterInfo(
                    id=r.reporter.id,
                    username=r.reporter.username,
                    profile_image_url=r.reporter.profile_image_url
                ) if r.reporter else None,
                target_type=r.target_type,
                target_id=r.target_id,
                target_preview=preview,
                reason=r.reason,
                details=r.details,
                status=r.status,
                resolved_by_id=r.resolved_by_id,
                resolver=ReportResolverInfo(
                    id=r.resolver.id,
                    username=r.resolver.username
                ) if r.resolver else None,
                resolution_notes=r.resolution_notes,
                created_at=r.created_at,
                resolved_at=r.resolved_at
            )
        )

    return ReportsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/admin/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    resolve_data: ReportResolveRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="신고 내역을 찾을 수 없습니다.")

    report.status = resolve_data.status
    report.resolved_by_id = admin_user.id
    report.resolution_notes = resolve_data.resolution_notes
    report.resolved_at = datetime.now()

    client_ip = request.client.host if request.client else None
    if resolve_data.action == "delete_content":
        if report.target_type == "post":
            post = db.query(Post).filter(Post.id == report.target_id).first()
            if post:
                db.delete(post)
        elif report.target_type == "reel":
            reel = db.query(Reel).filter(Reel.id == report.target_id).first()
            if reel:
                db.delete(reel)
        elif report.target_type == "comment":
            comment = db.query(Comment).filter(Comment.id == report.target_id).first()
            if comment:
                db.delete(comment)
    elif resolve_data.action == "suspend_user":
        target_uid = None
        if report.target_type == "user":
            target_uid = report.target_id
        elif report.target_type == "post":
            post = db.query(Post).filter(Post.id == report.target_id).first()
            if post:
                target_uid = post.user_id
        elif report.target_type == "reel":
            reel = db.query(Reel).filter(Reel.id == report.target_id).first()
            if reel:
                target_uid = reel.user_id

        if target_uid:
            target_u = db.query(User).filter(User.id == target_uid).first()
            if target_u and not target_u.is_admin:
                target_u.is_suspended = True
                target_u.suspension_reason = f"신고 처리로 인한 이용 정지 (사유: {report.reason})"

    audit = AdminAuditLog(
        admin_id=admin_user.id,
        admin_username=admin_user.username,
        action=f"RESOLVE_REPORT_{resolve_data.status.upper()}",
        target_type="report",
        target_id=report.id,
        target_identifier=f"{report.target_type}:{report.target_id}",
        reason=f"{resolve_data.resolution_notes or ''} (조치: {resolve_data.action or 'none'})".strip(),
        ip_address=client_ip
    )
    db.add(audit)
    db.commit()

    return {"message": f"신고 (ID: {report_id})가 성공적으로 {resolve_data.status} 처리되었습니다."}
