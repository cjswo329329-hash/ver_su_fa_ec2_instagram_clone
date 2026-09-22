from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.schemas.post import PostResponse
from app.schemas.common import PaginatedResponse
from app.core.deps import get_current_user, get_optional_current_user
from app.routers.posts import serialize_post
from app.services.recommendation_service import (
    get_user_taste_profile,
    recommend_posts_for_user,
    invalidate_taste_profile
)

router = APIRouter(prefix="/recommendations", tags=["Recommendations Engine"])


class CategoryScore(BaseModel):
    category: str
    score: float


class TasteProfileResponse(BaseModel):
    user_id: int
    is_cold_start: bool
    total_actions: int
    category_weights: Dict[str, float]
    top_categories: List[CategoryScore]
    top_authors: List[int]
    updated_at: str


@router.get("/my-taste", response_model=TasteProfileResponse)
def get_my_taste_profile_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    현재 로그인 유저의 실시간 추천 취향 프로필 분석 조회.
    - 16대 카테고리별 정규화된 선호도 가중치
    - 상위 5대 관심 카테고리
    - 지수 시간 감쇄(Time Decay) 적용 결과
    """
    profile = get_user_taste_profile(current_user.id, db)
    return profile


@router.post("/refresh-taste", response_model=TasteProfileResponse)
def refresh_my_taste_profile_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """취향 프로필 인메모리 캐시 강제 무효화 및 즉시 재계산"""
    invalidate_taste_profile(current_user.id)
    profile = get_user_taste_profile(current_user.id, db, force_refresh=True)
    return profile


@router.get("/posts", response_model=PaginatedResponse[PostResponse])
def get_recommended_posts_endpoint(
    limit: int = Query(10, ge=1, le=50),
    cursor: Optional[int] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    개인화 추천 게시물 전용 엔드포인트:
    - 기시청(Seen Filter) 및 부정 피드백 자동 배제
    - Taste Affinity + Engagement + Freshness + Social Proof 복합 랭킹
    - 다양성 재정렬(Interleaving) 적용
    """
    user_id = current_user.id if current_user else None
    following_ids = set()
    if user_id:
        f_rows = db.query(Follow.following_id).filter(
            Follow.follower_id == user_id,
            Follow.status == "accepted"
        ).all()
        following_ids = {r[0] for r in f_rows}

    posts, has_more, next_cursor = recommend_posts_for_user(
        db=db,
        user_id=user_id,
        limit=limit,
        cursor=cursor,
        following_ids=following_ids
    )

    items = [serialize_post(p, current_user, db=None, following_ids=following_ids) for p in posts]
    return PaginatedResponse(items=items, next_cursor=next_cursor, has_more=has_more)
