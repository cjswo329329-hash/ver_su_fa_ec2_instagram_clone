from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    TokenResponse,
    TokenRefreshRequest,
    LoginRequest,
    PasswordChangeRequest,
    VerifyAccountRequest,
    PasswordResetRequest,
)
from app.schemas.user import UserCreate, UserSimple
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=TokenResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 등록된 아이디 또는 이메일입니다.")
    
    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        profile_image_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        is_private=False,
        is_verified=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSimple.from_orm(user)
    )

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    identifier = login_data.username_or_email or login_data.username or login_data.email
    if not identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="아이디 또는 이메일을 입력해주세요.")
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    if getattr(user, "is_suspended", False):
        reason = getattr(user, "suspension_reason", None) or "운영 정책 위반"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"이용이 정지된 계정입니다. (사유: {reason})"
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserSimple.from_orm(user)
    )

@router.post("/refresh")
def refresh_token(req: TokenRefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 리프레시 토큰입니다.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 리프레시 토큰입니다.")
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰 형식입니다.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
    new_access_token = create_access_token(user.id)
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserSimple)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not req.old_password or not req.old_password.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이전 비밀번호를 입력해주세요.")

    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이전 비밀번호가 일치하지 않습니다.")

    new_pwd = req.new_password.strip() if req.new_password else ""
    if len(new_pwd) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="새 비밀번호는 6자 이상이어야 합니다.")

    if verify_password(new_pwd, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="새 비밀번호는 이전 비밀번호와 달라야 합니다.")

    current_user.hashed_password = get_password_hash(new_pwd)
    db.commit()
    return {"message": "비밀번호가 성공적으로 변경되었습니다.", "success": True}

@router.post("/verify-account")
def verify_account(req: VerifyAccountRequest, db: Session = Depends(get_db)):
    identifier = req.username_or_email.strip() if req.username_or_email else ""
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사용자 이름 또는 이메일을 입력해주세요.")
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="입력하신 정보와 일치하는 계정을 찾을 수 없습니다.")

    # 마스킹 이메일 생성 (예: al***@domain.com)
    email = user.email or ""
    if "@" in email:
        parts = email.split("@")
        u_part = parts[0]
        masked_u = (u_part[:2] + "*" * max(1, len(u_part) - 2)) if len(u_part) > 2 else (u_part + "***")
        masked_email = f"{masked_u}@{parts[1]}"
    else:
        masked_email = "***"

    return {
        "exists": True,
        "username": user.username,
        "email": masked_email,
        "full_name": user.full_name,
        "profile_image_url": user.profile_image_url,
    }

@router.post("/reset-password")
def reset_password(req: PasswordResetRequest, db: Session = Depends(get_db)):
    identifier = req.username_or_email.strip() if req.username_or_email else ""
    new_pwd = req.new_password.strip() if req.new_password else ""

    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="사용자 이름 또는 이메일을 입력해주세요.")
    if len(new_pwd) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="새 비밀번호는 6자 이상이어야 합니다.")

    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="입력하신 정보와 일치하는 계정을 찾을 수 없습니다.")

    user.hashed_password = get_password_hash(new_pwd)
    db.commit()
    return {
        "message": "비밀번호가 성공적으로 재설정되었습니다. 새 비밀번호로 로그인해주세요.",
        "username": user.username,
        "success": True,
    }

