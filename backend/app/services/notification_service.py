from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification

class NotificationService:
    @staticmethod
    def send_notification(
        db: Session,
        recipient_id: int,
        sender_id: int,
        notif_type: str,
        target_id: Optional[int] = None,
        commit: bool = True
    ) -> Optional[Notification]:
        """
        사용자 알림을 생성합니다.
        자신에게 보내는 알림은 무시됩니다.
        """
        if recipient_id == sender_id:
            return None

        # 중복 알림 방지 (동일 송신자, 수신자, 타입, 타겟)
        existing = db.query(Notification).filter(
            Notification.recipient_id == recipient_id,
            Notification.sender_id == sender_id,
            Notification.type == notif_type,
            Notification.target_id == target_id
        ).first()

        if existing:
            return existing

        notif = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            type=notif_type,
            target_id=target_id
        )
        db.add(notif)
        if commit:
            db.commit()
            db.refresh(notif)
        return notif

    @staticmethod
    def cancel_notification(
        db: Session,
        recipient_id: int,
        sender_id: int,
        notif_type: str,
        target_id: Optional[int] = None,
        commit: bool = True
    ) -> int:
        """
        특정 알림(좋아요 취소, 언팔로우 등)을 데이터베이스에서 삭제합니다.
        삭제된 알림 레코드 수를 반환합니다.
        """
        query = db.query(Notification).filter(
            Notification.recipient_id == recipient_id,
            Notification.sender_id == sender_id,
            Notification.type == notif_type
        )
        if target_id is not None:
            query = query.filter(Notification.target_id == target_id)

        deleted_count = query.delete(synchronize_session=False)
        if commit and deleted_count > 0:
            db.commit()
        return deleted_count

# 싱글톤 인스턴스 또는 편의 함수 노출
send_notification = NotificationService.send_notification
cancel_notification = NotificationService.cancel_notification
