import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import json
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.user import User
from app.models.direct import Conversation, Message
from app.core.security import get_password_hash

def seed_direct():
    db = SessionLocal()
    try:
        # 1. 타겟 유저 확인 (id=2 또는 'my wife' 또는 홍기영)
        target_user = db.query(User).filter(User.id == 2).first()
        if not target_user:
            target_user = db.query(User).filter(User.email == "cjswo329329@gmail.com").first()
        if not target_user:
            print("❌ 타겟 유저(홍기영/my wife)를 찾을 수 없습니다.")
            return

        print(f"[User] ID={target_user.id}, Username={target_user.username}")

        # 2. Mock 대화 상대 5인 프로필 정의
        mock_partners = [
            {
                "username": "전진님",
                "full_name": "전진",
                "email": "junjin@instagram.local",
                "profile_image_url": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=150&auto=format&fit=crop&q=80",
                "conv_id": "conv-1",
                "messages": [
                    {"id": "msg-101", "is_me": False, "text": "형 저번에 추천해주신 카페 가봤어요 ㅋㅋㅋ"},
                    {"id": "msg-102", "is_me": True, "text": "오 어땠어? 필터 커피 괜찮았지?"},
                    {"id": "msg-103", "is_me": False, "text": "네 분위기 미쳤더라고요 ㅋㅋㅋ 사람도 엄청 많았어요"},
                    {"id": "msg-104", "is_me": True, "text": "ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ"}
                ]
            },
            {
                "username": "현 아님",
                "full_name": "김현아",
                "email": "hyuna@instagram.local",
                "profile_image_url": "https://images.unsplash.com/photo-1552053831-71594a27632d?w=150&auto=format&fit=crop&q=80",
                "conv_id": "conv-2",
                "messages": [
                    {"id": "msg-201", "is_me": True, "text": "현아님 디자인 시안 최종 확인 부탁드려요~"},
                    {"id": "msg-202", "is_me": False, "text": "헠ㅋㅋ큐ㅠㅠ 넴넴!!", "reaction": "❤️"}
                ]
            },
            {
                "username": "Jihan님",
                "full_name": "이지한",
                "email": "jihan@instagram.local",
                "profile_image_url": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
                "conv_id": "conv-3",
                "messages": [
                    {"id": "msg-301", "is_me": True, "text": "지한아 이번 주에 시간 돼?"},
                    {"id": "msg-302", "is_me": False, "text": "오키오키 금욜에 보자"}
                ]
            },
            {
                "username": "별🌻님",
                "full_name": "별",
                "email": "star_flower@instagram.local",
                "profile_image_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                "conv_id": "conv-4",
                "messages": [
                    {
                        "id": "msg-401",
                        "is_me": False,
                        "text": "프로젝트 관련 참고 자료 보내드려요!",
                        "media_url": "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=600&auto=format&fit=crop&q=80",
                        "reaction": "❤️"
                    }
                ]
            },
            {
                "username": "kakruso님",
                "full_name": "카크루소",
                "email": "kakruso@instagram.local",
                "profile_image_url": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
                "conv_id": "conv-5",
                "messages": [
                    {"id": "msg-501", "is_me": False, "text": "안녕하세요! 유튜브 영상 보고 연락드렸습니다."},
                    {"id": "msg-502", "is_me": True, "text": "감사합니다! 어떤 부분 도움 필요하신가요?"}
                ]
            }
        ]

        default_pw = get_password_hash("pass123")

        for item in mock_partners:
            # 1. 파트너 유저 확인/생성
            partner = db.query(User).filter(User.username == item["username"]).first()
            if not partner:
                partner = User(
                    username=item["username"],
                    email=item["email"],
                    hashed_password=default_pw,
                    full_name=item["full_name"],
                    profile_image_url=item["profile_image_url"],
                    is_verified=False
                )
                db.add(partner)
                db.commit()
                db.refresh(partner)
                print(f"  + 파트너 생성: {partner.username} (ID={partner.id})")
            else:
                partner.profile_image_url = item["profile_image_url"]
                partner.full_name = item["full_name"]
                db.commit()

            # 2. Conversation 등록 (conv-1 ~ conv-5)
            u1, u2 = min(target_user.id, partner.id), max(target_user.id, partner.id)
            conv = db.query(Conversation).filter(Conversation.id == item["conv_id"]).first()
            if not conv:
                conv = Conversation(
                    id=item["conv_id"],
                    user1_id=u1,
                    user2_id=u2,
                    created_at=datetime.utcnow() - timedelta(days=7),
                    updated_at=datetime.utcnow()
                )
                db.add(conv)
                db.commit()
                db.refresh(conv)
                print(f"  + 대화방 생성: {conv.id} ({target_user.username} <-> {partner.username})")
            else:
                conv.user1_id = u1
                conv.user2_id = u2
                db.commit()

            # 3. Message 등록
            for m in item["messages"]:
                msg = db.query(Message).filter(Message.id == m["id"]).first()
                if not msg:
                    sender_id = target_user.id if m["is_me"] else partner.id
                    reactions_json = json.dumps([m["reaction"]]) if "reaction" in m else "[]"
                    msg = Message(
                        id=m["id"],
                        conversation_id=conv.id,
                        sender_id=sender_id,
                        text=m.get("text"),
                        media_url=m.get("media_url"),
                        is_read=True,
                        reactions=reactions_json,
                        created_at=datetime.utcnow() - timedelta(days=2)
                    )
                    db.add(msg)
            db.commit()

        print(f"✅ DM 대화방 및 메시지 시드 완료! 총 대화방: {db.query(Conversation).count()}개, 총 메시지: {db.query(Message).count()}건")

    finally:
        db.close()

if __name__ == "__main__":
    seed_direct()
