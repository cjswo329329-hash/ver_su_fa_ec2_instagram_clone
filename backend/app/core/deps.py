from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token
from app.core.exceptions import CredentialsException
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise CredentialsException()
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise CredentialsException("유효하지 않거나 만료된 토큰입니다.")
    user_id = payload.get("sub")
    if not user_id:
        raise CredentialsException()
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise CredentialsException("유효하지 않은 사용자 ID 형식입니다.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise CredentialsException("사용자를 찾을 수 없습니다.")
    if getattr(user, "is_suspended", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"이용이 정지된 계정입니다. (사유: {user.suspension_reason or '운영 정책 위반'})"
        )
    return user

def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return None
    return db.query(User).filter(User.id == uid).first()

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다."
        )
    return current_user
