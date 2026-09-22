from typing import Optional, Any
from pydantic import BaseModel, model_validator
from app.schemas.user import UserSimple

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserSimple

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class LoginRequest(BaseModel):
    username_or_email: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

    @model_validator(mode="before")
    @classmethod
    def normalize_credentials(cls, data: Any) -> Any:
        if isinstance(data, dict):
            identifier = data.get("username_or_email") or data.get("username") or data.get("email")
            if identifier:
                data["username_or_email"] = identifier
        return data

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            old_pwd = data.get("old_password") or data.get("current_password")
            if old_pwd:
                data["old_password"] = old_pwd
        return data

class VerifyAccountRequest(BaseModel):
    username_or_email: str

class VerifyAccountResponse(BaseModel):
    exists: bool
    username: str
    email: str
    full_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    reset_token: str

class PasswordResetRequest(BaseModel):
    username_or_email: str
    new_password: str
    reset_token: str

