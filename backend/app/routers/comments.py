from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models.comment import Comment
from app.models.post import Post
from app.models.reel import Reel
from app.models.user import User
from app.models.like import Like
from app.schemas.comment import CommentResponse, CommentReplyResponse, CommentCreate
from app.core.deps import get_current_user, get_optional_current_user
from app.routers.posts import check_post_access
from app.services.notification_service import send_notification
from app.routers.explore import invalidate_explore_cache

router = APIRouter(tags=["Comments"])

def _build_comments_response(
    filter_clause,
    db: Session,
    current_user: Optional[User]
) -> List[CommentResponse]:
    """공통 댓글 및 대댓글 계층 구조 빌더 (단일 통합 쿼리 & Eager Loading으로 초고속 응답)"""
    # 단일 통합 쿼리로 모든 댓글과 author, likes 동시 로딩 (DB 왕복 횟수 최소화)
    all_comments = (
        db.query(Comment)
        .options(
            joinedload(Comment.author),
            selectinload(Comment.likes),
        )
        .filter(filter_clause)
        .order_by(Comment.created_at.asc())
        .all()
    )

    root_comments = []
    replies_map = {}

    for c in all_comments:
        is_liked = False
        if current_user:
            is_liked = any(like.user_id == current_user.id for like in c.likes)

        if c.parent_id is None:
            root_comments.append(c)
        else:
            if c.parent_id not in replies_map:
                replies_map[c.parent_id] = []
            replies_map[c.parent_id].append(
                CommentReplyResponse(
                    id=c.id,
                    post_id=c.post_id,
                    reel_id=c.reel_id,
                    parent_id=c.parent_id,
                    content=c.content,
                    created_at=c.created_at,
                    author=c.author,
                    likes_count=len(c.likes),
                    is_liked=is_liked
                )
            )

    results = []
    for c in root_comments:
        is_liked = False
        if current_user:
            is_liked = any(like.user_id == current_user.id for like in c.likes)
        
        c_replies = replies_map.get(c.id, [])
        results.append(
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                reel_id=c.reel_id,
                parent_id=c.parent_id,
                content=c.content,
                created_at=c.created_at,
                author=c.author,
                likes_count=len(c.likes),
                is_liked=is_liked,
                replies=c_replies,
                replies_count=len(c_replies)
            )
        )
    return results

@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    post = db.query(Post).options(joinedload(Post.author)).filter(Post.id == post_id).first()
    if not post:
        # Smart Fallback: 릴스 ID인지 확인
        reel = db.query(Reel).filter(Reel.id == post_id).first()
        if reel:
            return _build_comments_response(Comment.reel_id == post_id, db, current_user)
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")

    if not check_post_access(post, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비공개 계정의 게시물입니다.")

    return _build_comments_response(Comment.post_id == post_id, db, current_user)

@router.get("/reels/{reel_id}/comments", response_model=List[CommentResponse])
def get_reel_comments(
    reel_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        # Smart Fallback: 포스트 ID인지 확인
        post = db.query(Post).filter(Post.id == reel_id).first()
        if post:
            return _build_comments_response(Comment.post_id == reel_id, db, current_user)
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    return _build_comments_response(Comment.reel_id == reel_id, db, current_user)

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
def add_comment(
    post_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        # Smart Fallback: 릴스 댓글로 전환
        reel = db.query(Reel).filter(Reel.id == post_id).first()
        if reel:
            return add_reel_comment(post_id, comment_in, db, current_user)
        raise HTTPException(status_code=404, detail="게시물을 찾을 수 없습니다.")

    if not check_post_access(post, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비공개 계정의 게시물에는 댓글을 작성할 수 없습니다.")

    parent_comment = None
    if comment_in.parent_id:
        parent_comment = db.query(Comment).filter(
            Comment.id == comment_in.parent_id,
            Comment.post_id == post_id
        ).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="부모 댓글을 찾을 수 없습니다.")

    comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        content=comment_in.content,
        parent_id=comment_in.parent_id
    )
    db.add(comment)

    # 상대방 게시물 또는 부모 댓글 작성자에게 알림 생성
    recipient_id = parent_comment.user_id if parent_comment else post.user_id
    send_notification(db, recipient_id=recipient_id, sender_id=current_user.id, notif_type="comment", target_id=post_id, commit=False)

    db.commit()
    db.refresh(comment)
    invalidate_explore_cache()

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        reel_id=comment.reel_id,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        author=current_user,
        likes_count=0,
        is_liked=False,
        replies=[],
        replies_count=0
    )

@router.post("/reels/{reel_id}/comments", response_model=CommentResponse)
def add_reel_comment(
    reel_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reel = db.query(Reel).filter(Reel.id == reel_id).first()
    if not reel:
        # Smart Fallback: 포스트 댓글로 전환
        post = db.query(Post).filter(Post.id == reel_id).first()
        if post:
            return add_comment(reel_id, comment_in, db, current_user)
        raise HTTPException(status_code=404, detail="릴스를 찾을 수 없습니다.")

    parent_comment = None
    if comment_in.parent_id:
        parent_comment = db.query(Comment).filter(
            Comment.id == comment_in.parent_id,
            Comment.reel_id == reel_id
        ).first()
        if not parent_comment:
            raise HTTPException(status_code=404, detail="부모 댓글을 찾을 수 없습니다.")

    comment = Comment(
        reel_id=reel_id,
        user_id=current_user.id,
        content=comment_in.content,
        parent_id=comment_in.parent_id
    )
    db.add(comment)

    # 릴스 작성자 또는 부모 댓글 작성자에게 알림 생성
    recipient_id = parent_comment.user_id if parent_comment else reel.user_id
    send_notification(db, recipient_id=recipient_id, sender_id=current_user.id, notif_type="comment", target_id=reel_id, commit=False)

    db.commit()
    db.refresh(comment)
    invalidate_explore_cache()

    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        reel_id=comment.reel_id,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        author=current_user,
        likes_count=0,
        is_liked=False,
        replies=[],
        replies_count=0
    )

@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    
    # 댓글 작성자 또는 게시물/릴스 소유자만 삭제 가능
    is_owner = (comment.user_id == current_user.id)
    if not is_owner and comment.post and comment.post.user_id == current_user.id:
        is_owner = True
    if not is_owner and comment.reel and comment.reel.user_id == current_user.id:
        is_owner = True

    if not is_owner:
        raise HTTPException(status_code=403, detail="댓글 작성자 또는 게시물 작성자만 삭제할 수 있습니다.")
    
    db.delete(comment)
    db.commit()
    invalidate_explore_cache()
    return {"message": "댓글이 삭제되었습니다."}

@router.post("/comments/{comment_id}/likes")
def toggle_comment_like(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")

    existing_like = db.query(Like).filter(Like.comment_id == comment_id, Like.user_id == current_user.id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        db.refresh(comment)
        return {"liked": False, "likes_count": len(comment.likes)}
    else:
        new_like = Like(comment_id=comment_id, user_id=current_user.id)
        db.add(new_like)
        db.commit()
        db.refresh(comment)
        return {"liked": True, "likes_count": len(comment.likes)}
