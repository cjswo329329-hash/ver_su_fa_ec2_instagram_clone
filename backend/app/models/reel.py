from datetime import datetime
from typing import Optional, List
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Reel(Base):
    __tablename__ = "reels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    video_url: Mapped[str] = mapped_column(String(500), nullable=False)
    poster_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tagged_user: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer, default=15000, nullable=False)
    audio_title: Mapped[str] = mapped_column(String(255), nullable=False)
    audio_cover_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    audio_is_explicit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shares_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reposts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # 관계 정의
    author = relationship("User", back_populates="reels")
    comments = relationship("Comment", back_populates="reel", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="reel", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="reel", cascade="all, delete-orphan")
    content_views = relationship("ContentView", back_populates="reel", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_reels_created", "created_at"),
        Index("idx_reels_category", "category"),
    )
