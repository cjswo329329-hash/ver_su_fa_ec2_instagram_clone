from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Boolean, DateTime, ForeignKey, Index, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ContentView(Base):
    """
    콘텐츠 조회/체류시간/완주율 기록 테이블 (피드, 릴스 등)
    - duration_ms: 체류 시간 (밀리초 단위, 1초 = 1,000ms)
    - watch_ratio: 시청 비율 (체류시간 / 전체영상길이, 예: 1.0=100% 완주, 2.5=2.5회 반복 루프)
    - completed: 릴스 완주 또는 게시물 상세 소비 여부
    - not_interested: 명시적 부정 피드백 (관심 없음 / 숨기기 클릭 여부)
    - source: 'feed', 'reels', 'explore', 'profile' 등 노출 경로
    """
    __tablename__ = "content_views"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=True)
    reel_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("reels.id", ondelete="CASCADE"), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watch_ratio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    not_interested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(30), default="feed", nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # 관계 정의
    user = relationship("User", back_populates="content_views")
    post = relationship("Post", back_populates="content_views")
    reel = relationship("Reel", back_populates="content_views")

    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN post_id IS NOT NULL THEN 1 ELSE 0 END + "
            " CASE WHEN reel_id IS NOT NULL THEN 1 ELSE 0 END) = 1",
            name="check_content_view_single_target"
        ),
        Index("idx_content_views_user", "user_id", "created_at"),
        Index("idx_content_views_post", "post_id", "created_at"),
        Index("idx_content_views_reel", "reel_id", "created_at"),
    )
