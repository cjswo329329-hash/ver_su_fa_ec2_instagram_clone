from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.content_view import ContentView
from app.models.post import Post
from app.models.reel import Reel
from app.models.user import User
from app.schemas.content_view import ContentViewCreate, ContentViewResponse
from app.core.deps import get_current_user

router = APIRouter(prefix="/views", tags=["Views & Dwell Time"])

@router.post("", response_model=ContentViewResponse, status_code=status.HTTP_201_CREATED)
def record_content_view(
    payload: ContentViewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    게시물 또는 릴스 시청/체류 시간(duration_ms) 및 완주/부정 시그널 기록
    - 1초 = 1,000ms
    - post_id 또는 reel_id 중 하나를 필수로 전달해야 합니다.
    - reel의 경우 watch_ratio가 전달되지 않으면 (체류시간 / 릴스총길이)로 자동 산출됩니다.
    """
    if payload.post_id is None and payload.reel_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="post_id 또는 reel_id 중 하나는 반드시 제공되어야 합니다."
        )
    if payload.post_id is not None and payload.reel_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="post_id와 reel_id를 동시에 지정할 수 없습니다."
        )

    computed_watch_ratio = payload.watch_ratio
    is_completed = payload.completed

    if payload.post_id is not None:
        post = db.query(Post).filter(Post.id == payload.post_id).first()
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="게시물을 찾을 수 없습니다.")
        if computed_watch_ratio == 0.0 and payload.duration_ms >= 3000:
            computed_watch_ratio = 1.0  # 게시물 3초 이상 체류 시 완독 간주
            is_completed = True

    if payload.reel_id is not None:
        reel = db.query(Reel).filter(Reel.id == payload.reel_id).first()
        if not reel:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="릴스를 찾을 수 없습니다.")
        reel_duration = reel.duration_ms if (reel.duration_ms and reel.duration_ms > 0) else 15000
        if computed_watch_ratio == 0.0 and payload.duration_ms > 0:
            computed_watch_ratio = round(payload.duration_ms / reel_duration, 3)
        if computed_watch_ratio >= 1.0:
            is_completed = True

    view = ContentView(
        user_id=current_user.id,
        post_id=payload.post_id,
        reel_id=payload.reel_id,
        duration_ms=payload.duration_ms,
        watch_ratio=computed_watch_ratio,
        completed=is_completed,
        not_interested=payload.not_interested,
        source=payload.source or "feed"
    )
    db.add(view)
    db.commit()
    db.refresh(view)

    return view

@router.get("/my", response_model=List[ContentViewResponse])
def get_my_views(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 로그인 유저의 최근 콘텐츠 시청 기록 조회"""
    views = db.query(ContentView)\
        .filter(ContentView.user_id == current_user.id)\
        .order_by(ContentView.created_at.desc())\
        .limit(limit)\
        .all()
    return views
