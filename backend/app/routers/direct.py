import json
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.database import get_db
from app.models.direct import Conversation, Message
from app.models.user import User
from app.schemas.direct import (
    ConversationResponse, ConversationCreate, MessageResponse, MessageCreate,
    ReactionToggleRequest, PartnerProfile
)
from app.core.deps import get_current_user
from app.core.utils import format_time_ago

router = APIRouter(prefix="/direct", tags=["Direct"])

def get_or_create_conversation(user1_id: int, user2_id: int, db: Session) -> Conversation:
    # user1_id < user2_id 형태로 일관성 유지
    u1, u2 = min(user1_id, user2_id), max(user1_id, user2_id)
    conv = db.query(Conversation).filter(
        Conversation.user1_id == u1,
        Conversation.user2_id == u2
    ).first()

    if not conv:
        conv_id = f"conv-{uuid.uuid4().hex[:8]}"
        conv = Conversation(
            id=conv_id,
            user1_id=u1,
            user2_id=u2
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    return conv

def serialize_message(msg: Message) -> MessageResponse:
    try:
        reactions_list = json.loads(msg.reactions) if msg.reactions else []
    except Exception:
        reactions_list = []

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        text=msg.text,
        media_url=msg.media_url,
        is_read=msg.is_read,
        reactions=reactions_list,
        created_at=msg.created_at,
        time_ago=format_time_ago(msg.created_at)
    )

def serialize_conversation(conv: Conversation, current_user_id: int, db: Session) -> ConversationResponse:
    partner_id = conv.user2_id if conv.user1_id == current_user_id else conv.user1_id
    partner = db.query(User).filter(User.id == partner_id).first()

    partner_profile = PartnerProfile(
        id=partner.id,
        username=partner.username,
        full_name=partner.full_name,
        profile_image_url=partner.profile_image_url,
        is_verified=partner.is_verified,
        is_online=False,
        last_active="최근 활동",
        is_muted=False,
        has_story=bool(partner.stories)
    )

    unread_count = db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != current_user_id,
        Message.is_read == False
    ).count()

    messages = [serialize_message(m) for m in conv.messages]

    return ConversationResponse(
        id=conv.id,
        partner=partner_profile,
        unread_count=unread_count,
        time_ago=format_time_ago(conv.updated_at),
        messages=messages,
        created_at=conv.created_at,
        updated_at=conv.updated_at
    )

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convs = db.query(Conversation).filter(
        or_(Conversation.user1_id == current_user.id, Conversation.user2_id == current_user.id)
    ).order_by(Conversation.updated_at.desc()).all()

    return [serialize_conversation(c, current_user.id, db) for c in convs]

@router.post("/conversations", response_model=ConversationResponse)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if conv_in.target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="자신과의 대화방은 만들 수 없습니다.")

    target = db.query(User).filter(User.id == conv_in.target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="대상 사용자를 찾을 수 없습니다.")

    conv = get_or_create_conversation(current_user.id, conv_in.target_user_id, db)
    return serialize_conversation(conv, current_user.id, db)

@router.get("/conversations/{conv_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conv_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="대화방을 찾을 수 없습니다.")
    if conv.user1_id != current_user.id and conv.user2_id != current_user.id:
        raise HTTPException(status_code=403, detail="해당 대화방에 접근할 권한이 없습니다.")

    messages = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at.asc()).all()
    return [serialize_message(m) for m in messages]

@router.post("/conversations/{conv_id}/messages", response_model=MessageResponse)
def send_message(
    conv_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="대화방을 찾을 수 없습니다.")
    if conv.user1_id != current_user.id and conv.user2_id != current_user.id:
        raise HTTPException(status_code=403, detail="해당 대화방에 메시지를 보낼 권한이 없습니다.")

    if not msg_in.text and not msg_in.media_url:
        raise HTTPException(status_code=400, detail="메시지 내용 또는 미디어가 필요합니다.")

    if msg_in.media_url and msg_in.media_url.startswith("blob:"):
        raise HTTPException(status_code=400, detail="브라우저 임시 Blob URL은 저장할 수 없습니다. 미디어를 먼저 업로드하세요.")

    msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    msg = Message(
        id=msg_id,
        conversation_id=conv_id,
        sender_id=current_user.id,
        text=msg_in.text,
        media_url=msg_in.media_url,
        is_read=False,
        reactions="[]"
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    return serialize_message(msg)

@router.post("/conversations/{conv_id}/read")
def mark_conversation_as_read(
    conv_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="대화방을 찾을 수 없습니다.")
    if conv.user1_id != current_user.id and conv.user2_id != current_user.id:
        raise HTTPException(status_code=403, detail="해당 대화방에 접근할 권한이 없습니다.")

    db.query(Message).filter(
        Message.conversation_id == conv_id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({"is_read": True})

    db.commit()
    return {"message": "모든 메시지를 읽음 처리했습니다."}

@router.post("/messages/{msg_id}/reactions")
def toggle_message_reaction(
    msg_id: str,
    req: ReactionToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg = db.query(Message).filter(Message.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="메시지를 찾을 수 없습니다.")

    conv = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first()
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="해당 대화방 참여자만 리액션을 남길 수 있습니다.")

    try:
        reactions_list = json.loads(msg.reactions) if msg.reactions else []
    except Exception:
        reactions_list = []

    if req.reaction in reactions_list:
        reactions_list.remove(req.reaction)
    else:
        reactions_list.append(req.reaction)

    msg.reactions = json.dumps(reactions_list, ensure_ascii=False)
    db.commit()

    return {"reactions": reactions_list}
