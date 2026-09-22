from typing import List, Optional
from urllib.parse import unquote
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.models.post import Post
from app.models.reel import Reel
from app.models.bookmark import Bookmark
from app.schemas.user import UserSimple, UserProfileResponse, UserUpdate, ProfileImageUpdate
from app.schemas.post import PostResponse, MediaResponse
from app.schemas.reel import ReelResponse
from app.core.deps import get_current_user, get_optional_current_user
from app.core.utils import format_time_ago
from app.routers.posts import serialize_post, POST_EAGER_OPTIONS
from app.routers.reels import serialize_reel

from sqlalchemy import func

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/suggestions", response_model=List[UserSimple])
def get_user_suggestions(
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = db.query(User)
    
    excluded_ids = set()
    if current_user:
        excluded_ids.add(current_user.id)
        # 이미 팔로우한 유저는 추천에서 제외
        followed_ids = db.query(Follow.following_id).filter(
            Follow.follower_id == current_user.id
        ).all()
        for f in followed_ids:
            excluded_ids.add(f[0])

    if excluded_ids:
        query = query.filter(User.id.notin_(excluded_ids))

    # 게시물을 보유한 활동 유저를 우선적으로 추천
    active_users = (
        query.join(Post, Post.user_id == User.id)
        .group_by(User.id)
        .order_by(func.count(Post.id).desc(), User.id.asc())
        .limit(limit)
        .all()
    )

    # 만약 활성 유저 수가 limit보다 적으면, 다른 유저로 보충
    if len(active_users) < limit:
        needed = limit - len(active_users)
        seen_ids = excluded_ids.union({u.id for u in active_users})
        other_users = (
            db.query(User)
            .filter(User.id.notin_(seen_ids))
            .order_by(User.id.asc())
            .limit(needed)
            .all()
        )
        active_users.extend(other_users)

    return active_users

@router.get("/search", response_model=List[UserSimple])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    users = db.query(User).filter(
        (User.username.ilike(f"%{q}%")) | (User.full_name.ilike(f"%{q}%"))
    ).limit(10).all()
    return users

@router.get("/saved", response_model=List[PostResponse])
def get_saved_posts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bookmarks = (
        db.query(Bookmark)
        .options(
            joinedload(Bookmark.post).joinedload(Post.author),
            joinedload(Bookmark.post).selectinload(Post.media),
            joinedload(Bookmark.post).selectinload(Post.likes),
            joinedload(Bookmark.post).selectinload(Post.bookmarks),
            joinedload(Bookmark.post).selectinload(Post.comments),
            joinedload(Bookmark.reel).joinedload(Reel.author),
            joinedload(Bookmark.reel).selectinload(Reel.likes),
            joinedload(Bookmark.reel).selectinload(Reel.comments),
        )
        .filter(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
        .all()
    )

    saved_items = []
    for b in bookmarks:
        if b.post:
            try:
                saved_items.append(serialize_post(b.post, current_user))
            except Exception:
                continue
        elif b.reel:
            r = b.reel
            if not r or not r.author:
                continue
            author_data = UserSimple(
                id=r.author.id,
                username=r.author.username,
                full_name=r.author.full_name,
                profile_image_url=r.author.profile_image_url,
                is_verified=r.author.is_verified,
                is_admin=r.author.is_admin,
            )
            saved_items.append(PostResponse(
                id=r.id,
                caption=r.caption,
                location=None,
                category=r.category,
                created_at=r.created_at,
                time_ago=format_time_ago(r.created_at),
                author=author_data,
                media=[MediaResponse(
                    id=r.id,
                    media_url=r.poster_url or r.video_url,
                    media_type="video",
                    order_index=0
                )],
                likes_count=len(r.likes),
                comments_count=len(r.comments),
                is_liked=any(l.user_id == current_user.id for l in r.likes),
                is_bookmarked=True,
                top_comments=[]
            ))
    return saved_items

@router.put("/profile", response_model=UserSimple)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if update_data.username and update_data.username != current_user.username:
        existing = db.query(User).filter(User.username == update_data.username).first()
        if existing:
            raise HTTPException(status_code=409, detail="이미 사용 중인 사용자 이름입니다.")
        current_user.username = update_data.username

    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    if update_data.bio is not None:
        current_user.bio = update_data.bio
    if update_data.website is not None:
        current_user.website = update_data.website
    if update_data.gender is not None:
        current_user.gender = update_data.gender
    if update_data.is_private is not None:
        current_user.is_private = update_data.is_private
    if update_data.profile_image_url is not None:
        current_user.profile_image_url = update_data.profile_image_url

    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/profile/image", response_model=UserSimple)
def update_profile_image(
    image_url: Optional[str] = Query(None),
    data: Optional[ProfileImageUpdate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    url = image_url
    if not url and data:
        url = data.get_url()
    if not url:
        raise HTTPException(status_code=400, detail="image_url이 필요합니다.")
    current_user.profile_image_url = url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/profile/image", response_model=UserSimple)
def delete_profile_image(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.profile_image_url = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    db.commit()
    db.refresh(current_user)
    return current_user

def build_user_profile(user: User, current_user: Optional[User], db: Session) -> UserProfileResponse:
    followers_count = db.query(Follow).filter(Follow.following_id == user.id, Follow.status == "accepted").count()
    following_count = db.query(Follow).filter(Follow.follower_id == user.id, Follow.status == "accepted").count()
    posts_count = len(user.posts)

    is_following = False
    is_requested = False
    is_me = False
    if current_user:
        if current_user.id == user.id:
            is_me = True
        else:
            follow = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.following_id == user.id).first()
            if follow:
                if follow.status == "accepted":
                    is_following = True
                elif follow.status == "pending":
                    is_requested = True

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        profile_image_url=user.profile_image_url,
        website=user.website,
        gender=user.gender,
        is_private=user.is_private,
        is_verified=user.is_verified,
        posts_count=posts_count,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        is_requested=is_requested,
        is_me=is_me
    )

@router.get("/profile/{username}", response_model=UserProfileResponse)
def get_user_profile_by_profile_path(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    decoded_username = unquote(username)
    user = db.query(User).filter(
        (User.username == username) | (User.username == decoded_username)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return build_user_profile(user, current_user, db)

@router.get("/{username}", response_model=UserProfileResponse)
def get_user_profile(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    decoded_username = unquote(username)
    user = db.query(User).filter(
        (User.username == username) | (User.username == decoded_username)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    return build_user_profile(user, current_user, db)

def can_view_user_content(target_user: User, current_user: Optional[User], db: Session) -> bool:
    if not target_user.is_private:
        return True
    if not current_user:
        return False
    if current_user.id == target_user.id:
        return True
    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == target_user.id,
        Follow.status == "accepted"
    ).first()
    return bool(follow)

@router.get("/{username}/posts", response_model=List[PostResponse])
def get_user_posts(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    decoded_username = unquote(username)
    user = db.query(User).filter(
        (User.username == username) | (User.username == decoded_username)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if not can_view_user_content(user, current_user, db):
        return []

    posts = (
        db.query(Post)
        .options(*POST_EAGER_OPTIONS)
        .filter(Post.user_id == user.id)
        .order_by(Post.created_at.desc())
        .all()
    )
    return [serialize_post(p, current_user) for p in posts]

@router.get("/{username}/reels", response_model=List[ReelResponse])
def get_user_reels(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    decoded_username = unquote(username)
    user = db.query(User).filter(
        (User.username == username) | (User.username == decoded_username)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if not can_view_user_content(user, current_user, db):
        return []

    reels = db.query(Reel).filter(Reel.user_id == user.id).order_by(Reel.created_at.desc()).all()
    return [serialize_reel(r, current_user, db) for r in reels]
