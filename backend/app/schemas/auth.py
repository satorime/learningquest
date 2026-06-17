from pydantic import BaseModel, EmailStr, Field, validator
from datetime import datetime
from typing import Optional


# --- Core user / token shapes ----------------------------------------------
class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[EmailStr] = None
    role: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: bool = True
    auth_provider: Optional[str] = "local"
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: UserResponse


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None


# --- Native auth requests ---------------------------------------------------
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    requires_verification: bool = True


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    # Accepts username OR email in the same field.
    username: str
    password: str


class GoogleAuthRequest(BaseModel):
    # Google ID token (JWT credential) returned by Google Identity Services.
    id_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# --- Admin user-management requests ----------------------------------------
class AdminCreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: str = "teacher"  # admin provisions teacher (or student) accounts


class AdminUpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None  # 'student' | 'teacher' | 'admin'

    @validator("role")
    def role_must_be_valid(cls, v):
        if v is None:
            return v
        allowed = {"student", "teacher", "admin"}
        if v not in allowed:
            raise ValueError(f"role must be one of {sorted(allowed)}")
        return v


class UpdateProfileRequest(BaseModel):
    """Fields a user may edit freely on their own profile.

    Email is intentionally excluded — changing it requires the verified
    email-change flow (request a code, then confirm it).
    """
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=2000)


class ChangeEmailRequest(BaseModel):
    new_email: EmailStr


class ConfirmEmailChangeRequest(BaseModel):
    code: str = Field(min_length=4, max_length=10)


# --- Legacy (kept until services/moodle.py is removed in Phase 2) -----------
class MoodleToken(BaseModel):
    token: str
    error: Optional[str] = None
