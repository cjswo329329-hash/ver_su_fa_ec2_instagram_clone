import time
from typing import List, Optional, Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.follow import Follow
from app.models.user import User
from app.models.notification import Notification
from app.schemas.user import UserSimple
from app.core.deps import get_current_user, get_optional_current_user
from app.services.notification_service import send_notification, cancel_notification

router = APIRouter(tags=["Follows"])

# 팔로워/팔로잉 빠른 응답용 인메모리 캐시 (호주 Supabase 원격 DB 지연 제거)
_follows_cache: Dict[str, Tuple[float, List[UserSimple]]] = {}
FOLLOWS_CACHE_TTL = 30.0

def invalidate_user_follows_cache(user_id: int):
    global _follows_cache
    keys_to_del = [k for k in _follows_cache if f"_{user_id}_" in k or k.endswith(f"_{user_id}")]
    for k in keys_to_del:
        _follows_cache.pop(k, None)

@router.post("/follows/{user_id}")
def toggle_follow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신을 팔로우할 수 없습니다.")
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    existing = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.following_id == user_id).first()
    if existing:
        db.delete(existing)
        # 팔로우 알림 정리 (공통 서비스 계층)
        cancel_notification(db, recipient_id=user_id, sender_id=current_user.id, notif_type="follow")
        cancel_notification(db, recipient_id=user_id, sender_id=current_user.id, notif_type="follow_request")
        db.commit()
        invalidate_user_follows_cache(user_id)
        invalidate_user_follows_cache(current_user.id)

        target_followers_count = db.query(Follow).filter(Follow.following_id == user_id, Follow.status == "accepted").count()
        current_following_count = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.status == "accepted").count()

        return {
            "following": False,
            "status": None,
            "target_followers_count": target_followers_count,
            "current_following_count": current_following_count
        }
    else:
        status = "pending" if target_user.is_private else "accepted"
        follow = Follow(follower_id=current_user.id, following_id=user_id, status=status)
        db.add(follow)

        # 상대방에게 알림 발송 (공통 서비스 계층)
        notif_type = "follow_request" if status == "pending" else "follow"
        send_notification(db, recipient_id=user_id, sender_id=current_user.id, notif_type=notif_type, target_id=current_user.id)
        db.commit()
        invalidate_user_follows_cache(user_id)
        invalidate_user_follows_cache(current_user.id)

        target_followers_count = db.query(Follow).filter(Follow.following_id == user_id, Follow.status == "accepted").count()
        current_following_count = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.status == "accepted").count()

        return {
            "following": True,
            "status": status,
            "target_followers_count": target_followers_count,
            "current_following_count": current_following_count
        }

@router.get("/follows/requests", response_model=List[UserSimple])
def get_pending_follow_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """현재 로그인 유저에게 온 대기 중인(pending) 팔로우 요청 목록 조회"""
    pending_follows = (
        db.query(Follow)
        .options(joinedload(Follow.follower))
        .filter(
            Follow.following_id == current_user.id,
            Follow.status == "pending"
        )
        .order_by(Follow.created_at.desc())
        .all()
    )

    requesters = [f.follower for f in pending_follows if f.follower]

    my_following_ids = {
        f.following_id for f in db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id,
            Follow.status == "accepted"
        ).all()
    }

    return [
        UserSimple(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            profile_image_url=u.profile_image_url,
            is_verified=u.is_verified,
            is_admin=u.is_admin,
            is_following=(u.id in my_following_ids)
        )
        for u in requesters
    ]

@router.post("/follows/requests/{requester_id}/accept")
def accept_follow_request(
    requester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """팔로우 요청 수락"""
    follow = db.query(Follow).filter(
        Follow.follower_id == requester_id,
        Follow.following_id == current_user.id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="팔로우 요청을 찾을 수 없습니다.")

    if follow.status == "accepted":
        my_followers_count = db.query(Follow).filter(Follow.following_id == current_user.id, Follow.status == "accepted").count()
        return {
            "message": "이미 수락된 팔로우 요청입니다.",
            "status": "accepted",
            "my_followers_count": my_followers_count
        }

    # 1. 상태를 accepted로 변경 (내 팔로워로 정식 편입)
    follow.status = "accepted"

    # 2. 기존 follow_request 알림 읽음 처리
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.sender_id == requester_id,
        Notification.type == "follow_request"
    ).update({"is_read": True}, synchronize_session=False)

    # 3. 요청자(requester)에게 팔로우 수락 알림(follow_accept) 발송 (공통 서비스 계층)
    send_notification(db, recipient_id=requester_id, sender_id=current_user.id, notif_type="follow_accept", target_id=current_user.id)
    db.commit()
    invalidate_user_follows_cache(current_user.id)
    invalidate_user_follows_cache(requester_id)

    # 최신 카운트 집계
    my_followers_count = db.query(Follow).filter(Follow.following_id == current_user.id, Follow.status == "accepted").count()
    my_following_count = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.status == "accepted").count()
    requester_following_count = db.query(Follow).filter(Follow.follower_id == requester_id, Follow.status == "accepted").count()

    return {
        "message": "팔로우 요청을 수락했습니다.",
        "status": "accepted",
        "my_followers_count": my_followers_count,
        "my_following_count": my_following_count,
        "requester_following_count": requester_following_count
    }

@router.post("/follows/requests/{requester_id}/reject")
def reject_follow_request(
    requester_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """팔로우 요청 거절/삭제"""
    follow = db.query(Follow).filter(
        Follow.follower_id == requester_id,
        Follow.following_id == current_user.id,
        Follow.status == "pending"
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="대기 중인 팔로우 요청을 찾을 수 없습니다.")

    db.delete(follow)

    # 관련 follow_request 알림 삭제
    db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.sender_id == requester_id,
        Notification.type == "follow_request"
    ).delete(synchronize_session=False)

    db.commit()
    invalidate_user_follows_cache(current_user.id)
    invalidate_user_follows_cache(requester_id)

    my_followers_count = db.query(Follow).filter(Follow.following_id == current_user.id, Follow.status == "accepted").count()

    return {
        "message": "팔로우 요청을 삭제했습니다.",
        "status": "rejected",
        "my_followers_count": my_followers_count
    }

@router.delete("/follows/followers/{follower_id}")
@router.delete("/users/followers/{follower_id}")
def remove_follower(
    follower_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """내 팔로워 목록에서 상대방을 삭제(강제 언팔로우)"""
    follow = db.query(Follow).filter(
        Follow.follower_id == follower_id,
        Follow.following_id == current_user.id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="팔로워를 찾을 수 없습니다.")

    db.delete(follow)
    db.commit()
    invalidate_user_follows_cache(current_user.id)
    invalidate_user_follows_cache(follower_id)

    my_followers_count = db.query(Follow).filter(Follow.following_id == current_user.id, Follow.status == "accepted").count()
    return {
        "message": "팔로워를 삭제했습니다.",
        "my_followers_count": my_followers_count
    }

@router.get("/users/{user_id}/followers", response_model=List[UserSimple])
@router.get("/follows/{user_id}/followers", response_model=List[UserSimple])
def get_user_followers(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # 1. 인메모리 캐시 검사 (Supabase 해외 왕복 지연 0초화)
    cache_key = f"followers_{user_id}_{current_user.id if current_user else 0}"
    now = time.time()
    if cache_key in _follows_cache:
        ts, data = _follows_cache[cache_key]
        if now - ts < FOLLOWS_CACHE_TTL:
            return data

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    follows = (
        db.query(Follow)
        .options(joinedload(Follow.follower))
        .filter(Follow.following_id == user_id, Follow.status == "accepted")
        .all()
    )
    followers = [f.follower for f in follows if f.follower]

    my_following_ids = set()
    if current_user:
        my_following_ids = {
            f.following_id for f in db.query(Follow.following_id).filter(
                Follow.follower_id == current_user.id,
                Follow.status == "accepted"
            ).all()
        }

    result = [
        UserSimple(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            profile_image_url=u.profile_image_url,
            is_verified=u.is_verified,
            is_admin=u.is_admin,
            is_following=(u.id in my_following_ids)
        )
        for u in followers
    ]

    _follows_cache[cache_key] = (now, result)
    return result

@router.get("/users/{user_id}/following", response_model=List[UserSimple])
@router.get("/follows/{user_id}/following", response_model=List[UserSimple])
def get_user_following(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    # 1. 인메모리 캐시 검사
    cache_key = f"following_{user_id}_{current_user.id if current_user else 0}"
    now = time.time()
    if cache_key in _follows_cache:
        ts, data = _follows_cache[cache_key]
        if now - ts < FOLLOWS_CACHE_TTL:
            return data

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    follows = (
        db.query(Follow)
        .options(joinedload(Follow.following))
        .filter(Follow.follower_id == user_id, Follow.status == "accepted")
        .all()
    )
    following = [f.following for f in follows if f.following]

    my_following_ids = set()
    if current_user:
        my_following_ids = {
            f.following_id for f in db.query(Follow.following_id).filter(
                Follow.follower_id == current_user.id,
                Follow.status == "accepted"
            ).all()
        }

    result = [
        UserSimple(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            profile_image_url=u.profile_image_url,
            is_verified=u.is_verified,
            is_admin=u.is_admin,
            is_following=(u.id in my_following_ids)
        )
        for u in following
    ]

    _follows_cache[cache_key] = (now, result)
    return result
