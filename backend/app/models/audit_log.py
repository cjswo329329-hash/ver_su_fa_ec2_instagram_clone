from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class AdminAuditLog(Base):
    __tablename__ = 'admin_audit_logs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    admin_username: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    target_identifier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False, index=True)

    __table_args__ = (
        Index('idx_audit_created_action', 'created_at', 'action'),
    )
