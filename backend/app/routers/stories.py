from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.story import Story, StoryView
from app.models.user import User
from app.models.follow import Follow
from app.schemas.story import UserStoryTrayItem, StoryItemResponse, StoryCreate
from app.schemas.user import UserSimple
from app.core.deps import get_current_user, get_optional_current_user

router = APIRouter(tags=["Stories"])

@router.get("/stories/feed", response_model=List[UserStoryTrayItem])
def get_stories_tray(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # 비로그인 게스트는 스토리 피드 열람 불가 (인스타그램 표준: 스토리 트레이는 로그인 유저 전용)
    if not current_user:
        return []

    now = datetime.utcnow()

    # 팔로우 관계 조회 (내가 팔로우 승인된 친구들의 ID 목록)
    f_rows = db.query(Follow.following_id).filter(
        Follow.follower_id == current_user.id,
        Follow.status == "accepted"
    ).all()
    following_ids = {r[0] for r in f_rows}

    # 스토리 트레이 노출 대상: 오직 "내가 팔로우한 사람"과 "나 자신"의 스토리만!
    allowed_user_ids = following_ids | {current_user.id}

    # 24시간 내 활성 스토리 목록 조회 (노출 대상 유저들로만 엄격히 필터링)
    active_stories = db.query(Story).filter(
        Story.user_id.in_(allowed_user_ids),
        Story.expires_at > now
    ).order_by(Story.created_at.desc()).all()

    # 유저별 그룹화
    user_stories_map = {}
    for s in active_stories:
        if not s.user:
            continue
        if s.user_id not in user_stories_map:
            user_stories_map[s.user_id] = {
                "user": s.user,
                "stories": [],
                "latest_time": s.created_at
            }
        is_viewed = any(v.user_id == current_user.id for v in s.views)
        user_stories_map[s.user_id]["stories"].append(
            StoryItemResponse(
                id=s.id,
                media_url=s.media_url,
                media_type=s.media_type,
                expires_at=s.expires_at,
                created_at=s.created_at,
                is_viewed=is_viewed
            )
        )

    tray_items = []
    # 1. 내 스토리 먼저 트레이 맨 앞에 배치
    if current_user.id in user_stories_map:
        my_data = user_stories_map[current_user.id]
        has_unseen = any(not st.is_viewed for st in my_data["stories"])
        tray_items.append(
            UserStoryTrayItem(
                user=UserSimple.from_orm(my_data["user"]),
                has_unseen=has_unseen,
                stories_count=len(my_data["stories"]),
                latest_story_time=my_data["latest_time"],
                stories=my_data["stories"]
            )
        )

    # 2. 내가 팔로우하는 친구들의 스토리 (미시청 우선 배치, 그 다음 최신순)
    other_items = []
    for uid, data in user_stories_map.items():
        if uid == current_user.id:
            continue
        has_unseen = any(not st.is_viewed for st in data["stories"])
        other_items.append(
            UserStoryTrayItem(
                user=UserSimple.from_orm(data["user"]),
                has_unseen=has_unseen,
                stories_count=len(data["stories"]),
                latest_story_time=data["latest_time"],
                stories=data["stories"]
            )
        )

    # 미시청 스토리를 앞쪽에 배치(선셋 그라디언트 링), 다 본 스토리는 뒤로(회색 링)
    other_items.sort(key=lambda x: (not x.has_unseen, -x.latest_story_time.timestamp() if x.latest_story_time else 0))
    tray_items.extend(other_items)
    return tray_items

@router.post("/stories")
def create_story(
    payload: Optional[StoryCreate] = None,
    media_url: Optional[str] = None,
    media_type: str = "image",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_url = payload.media_url if payload else media_url
    target_type = (payload.media_type if payload else media_type) or "image"
    if not target_url:
        raise HTTPException(status_code=400, detail="스토리 미디어 URL이 필요합니다.")

    expires = datetime.utcnow() + timedelta(hours=24)
    story = Story(
        user_id=current_user.id,
        media_url=target_url,
        media_type=target_type,
        expires_at=expires
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return {"message": "스토리가 성공적으로 등록되었습니다.", "id": story.id}

@router.post("/stories/{story_id}/view")
def view_story(
    story_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="스토리를 찾을 수 없습니다.")

    # 비공개 계정 스토리 열람 인가 검증
    if story.user and story.user.is_private and story.user_id != current_user.id:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == story.user_id,
            Follow.status == "accepted"
        ).first()
        if not is_following:
            raise HTTPException(status_code=403, detail="비공개 계정의 스토리는 팔로워만 조회할 수 있습니다.")

    existing_view = db.query(StoryView).filter(
        StoryView.story_id == story_id,
        StoryView.user_id == current_user.id
    ).first()

    if not existing_view:
        view = StoryView(story_id=story_id, user_id=current_user.id)
        db.add(view)
        db.commit()

    return {"message": "스토리 시청이 기록되었습니다."}

@router.get("/users/{username}/highlights")
def get_user_highlights(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 비공개 계정 하이라이트 보호
    if user.is_private:
        is_allowed = False
        if current_user:
            if current_user.id == user.id:
                is_allowed = True
            else:
                follow = db.query(Follow).filter(
                    Follow.follower_id == current_user.id,
                    Follow.following_id == user.id,
                    Follow.status == "accepted"
                ).first()
                if follow:
                    is_allowed = True
        if not is_allowed:
            return []

    # 스토리 기반 하이라이트 목록 (예: 최근 만료된 스토리들로 그룹화)
    stories = db.query(Story).filter(Story.user_id == user.id).order_by(Story.created_at.desc()).limit(10).all()
    highlights = []
    if stories:
        highlights.append({
            "id": 1,
            "title": "일상 ✨",
            "cover_image": stories[0].media_url,
            "stories_count": len(stories)
        })
    return highlights
