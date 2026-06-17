"""Native authentication routes (email/password + Google Sign-In).

Replaces the previous Moodle-backed login flow. Issues our own JWT access +
refresh tokens, stored in the `tokens` table so they can be revoked.
"""
from datetime import datetime, timedelta, timezone
import logging
import re
import secrets


def _utcnow() -> datetime:
    """Timezone-aware UTC now (matches the DB's timestamptz columns)."""
    return datetime.now(timezone.utc)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database.connection import get_db
from app.models.user import User
from app.schemas.auth import (
    UserResponse,
    Token,
    RegisterRequest,
    RegisterResponse,
    VerifyEmailRequest,
    ResendVerificationRequest,
    LoginRequest,
    GoogleAuthRequest,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    ChangeEmailRequest,
    ConfirmEmailChangeRequest,
)
from app.services.activity_log_service import log_activity
from app.services.google_auth import verify_google_id_token, GoogleAuthError
from app.services.email import send_verification_code, send_email_change_code
from app.utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_active_user,
    store_token,
    revoke_token,
    decode_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from app.config import RESET_TOKEN_EXPIRE_MINUTES, VERIFICATION_CODE_EXPIRE_MINUTES
from app.utils.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP throttles on credential / code / email endpoints (brute-force + abuse).
_rl_login = rate_limit("login", max_calls=10, window_seconds=300)
_rl_register = rate_limit("register", max_calls=5, window_seconds=600)
_rl_verify = rate_limit("verify_email", max_calls=10, window_seconds=300)
_rl_resend = rate_limit("resend_verification", max_calls=3, window_seconds=600)
_rl_forgot = rate_limit("forgot_password", max_calls=5, window_seconds=900)
_rl_reset = rate_limit("reset_password", max_calls=10, window_seconds=900)
_rl_google = rate_limit("google_login", max_calls=20, window_seconds=300)


# --- helpers ----------------------------------------------------------------
def _issue_tokens(db: Session, user: User) -> Token:
    """Create + persist access/refresh tokens and build the Token response."""
    access_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.username})

    store_token(db, access_token, user.id, "access",
                _utcnow() + access_expires)
    store_token(db, refresh_token, user.id, "refresh",
                _utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    user.last_login = _utcnow()
    db.commit()

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


def _new_verification_code() -> str:
    """A 6-digit numeric verification code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _unique_username(db: Session, base: str) -> str:
    """Derive a unique username from a base string."""
    candidate = re.sub(r"[^a-zA-Z0-9_.-]", "", base).lower() or "user"
    candidate = candidate[:90]
    if not db.query(User).filter(User.username == candidate).first():
        return candidate
    while True:
        suffix = secrets.token_hex(3)
        new = f"{candidate[:80]}_{suffix}"
        if not db.query(User).filter(User.username == new).first():
            return new


# --- registration / login ---------------------------------------------------
def _issue_verification(db: Session, user: User) -> None:
    """Generate, store, and send a fresh email-verification code."""
    code = _new_verification_code()
    user.verification_code = code
    user.verification_code_expires = _utcnow() + timedelta(
        minutes=VERIFICATION_CODE_EXPIRE_MINUTES
    )
    db.commit()
    send_verification_code(user.email, code, VERIFICATION_CODE_EXPIRE_MINUTES)


@router.post("/register", response_model=RegisterResponse,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(_rl_register)])
async def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Self-registration. Creates an unverified student and emails a code."""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role="student",
        auth_provider="local",
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _issue_verification(db, user)
    log_activity(db=db, user_id=user.id, action_type="register",
                 action_details={"method": "local"},
                 related_entity_type="user", related_entity_id=user.id)
    return RegisterResponse(
        message="Account created. Check your email for a verification code.",
        email=user.email,
    )


@router.post("/verify-email", response_model=Token,
             dependencies=[Depends(_rl_verify)])
async def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Confirm the emailed code; on success verify the account and log in."""
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.is_verified:
        # Already verified — just log them in.
        return _issue_tokens(db, user)
    if (not user.verification_code or not user.verification_code_expires
            or user.verification_code_expires < _utcnow()):
        raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
    if data.code.strip() != user.verification_code:
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    db.commit()
    return _issue_tokens(db, user)


@router.post("/resend-verification", dependencies=[Depends(_rl_resend)])
async def resend_verification(
    data: ResendVerificationRequest, db: Session = Depends(get_db)
):
    """Re-send a verification code. Always returns success (no enumeration)."""
    user = db.query(User).filter(User.email == data.email).first()
    if user and not user.is_verified:
        _issue_verification(db, user)
    return {"message": "If that account needs verification, a new code was sent."}


@router.post("/login", response_model=Token, dependencies=[Depends(_rl_login)])
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Email/username + password login."""
    user = db.query(User).filter(
        or_(User.username == data.username, User.email == data.username)
    ).first()

    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    if not user.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Check your inbox for a verification code.",
        )

    log_activity(db=db, user_id=user.id, action_type="login",
                 action_details={"method": "local"},
                 related_entity_type="user", related_entity_id=user.id)
    return _issue_tokens(db, user)


@router.post("/google", response_model=Token, dependencies=[Depends(_rl_google)])
async def google_login(data: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Sign in / sign up with a Google ID token. New users default to student."""
    try:
        claims = verify_google_id_token(data.id_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    google_sub = claims["sub"]
    email = claims["email"]

    user = db.query(User).filter(
        or_(User.google_id == google_sub, User.email == email)
    ).first()

    if user:
        # Link Google to an existing (possibly local) account.
        if not user.google_id:
            user.google_id = google_sub
            user.auth_provider = "both" if user.password_hash else "google"
        if not user.profile_image_url and claims.get("picture"):
            user.profile_image_url = claims["picture"]
        user.is_verified = True  # Google has verified the email
    else:
        user = User(
            username=_unique_username(db, email.split("@")[0]),
            email=email,
            password_hash=None,
            first_name=claims.get("given_name", ""),
            last_name=claims.get("family_name", ""),
            role="student",
            auth_provider="google",
            google_id=google_sub,
            profile_image_url=claims.get("picture"),
            is_active=True,
            is_verified=True,
        )
        db.add(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    db.commit()
    db.refresh(user)

    log_activity(db=db, user_id=user.id, action_type="login",
                 action_details={"method": "google"},
                 related_entity_type="user", related_entity_id=user.id)
    return _issue_tokens(db, user)


# --- session management ------------------------------------------------------
@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access/refresh pair."""
    payload = decode_token(data.refresh_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    from app.models.auth import Token as TokenModel
    stored = db.query(TokenModel).filter(
        TokenModel.token == data.refresh_token,
        TokenModel.token_type == "refresh",
        TokenModel.revoked == False,
    ).first()
    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token not recognized")

    user = db.query(User).filter(User.username == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Rotate: revoke the used refresh token.
    revoke_token(db, data.refresh_token)
    return _issue_tokens(db, user)


@router.post("/logout")
async def logout(
    data: RefreshRequest | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Revoke the caller's refresh token (and best-effort all their tokens)."""
    from app.models.auth import Token as TokenModel
    db.query(TokenModel).filter(
        TokenModel.user_id == current_user.id
    ).update({TokenModel.revoked: True})
    db.commit()
    return {"message": "Logout successful"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Return the currently authenticated user."""
    return UserResponse.model_validate(current_user)


# --- password recovery -------------------------------------------------------
@router.post("/forgot-password", dependencies=[Depends(_rl_forgot)])
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Issue a password-reset token. Always returns success (no user enumeration).

    NOTE: email delivery is stubbed — the token is logged for development until
    an SMTP provider is wired.
    """
    user = db.query(User).filter(User.email == data.email).first()
    if user and user.password_hash is not None:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = _utcnow() + timedelta(
            minutes=RESET_TOKEN_EXPIRE_MINUTES
        )
        db.commit()
        logger.info("[DEV] Password reset token for %s: %s", user.email, token)
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", dependencies=[Depends(_rl_reset)])
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a reset token and set a new password."""
    user = db.query(User).filter(User.reset_token == data.token).first()
    if (not user or not user.reset_token_expires
            or user.reset_token_expires < _utcnow()):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = get_password_hash(data.new_password)
    user.auth_provider = "both" if user.google_id else "local"
    user.reset_token = None
    user.reset_token_expires = None
    # Force re-login everywhere.
    from app.models.auth import Token as TokenModel
    db.query(TokenModel).filter(TokenModel.user_id == user.id).update(
        {TokenModel.revoked: True}
    )
    db.commit()
    return {"message": "Password updated. Please sign in again."}


# --- lightweight public profile ---------------------------------------------
def _serialize_user_profile(user: User, db: Session, is_privileged: bool) -> dict:
    """Profile payload + best-effort gamification stats. Shared by GET/PUT."""
    quests_completed = 0
    badges_earned = 0
    current_level = 1
    try:
        from app.models.quest import QuestProgress
        from app.models.badge import UserBadge
        from app.models.virtual_pet import VirtualPet

        quests_completed = db.query(QuestProgress).filter(
            QuestProgress.user_id == user.id,
            QuestProgress.status == "completed",
        ).count()
        badges_earned = db.query(UserBadge).filter(
            UserBadge.user_id == user.id
        ).count()
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == user.id).first()
        current_level = pet.level if pet else 1
    except Exception as exc:  # noqa: BLE001 - stats are best-effort
        logger.error("Error getting user stats: %s", exc)

    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email if is_privileged else None,
        "profile_image_url": user.profile_image_url,
        "role": user.role,
        "bio": user.bio,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "current_level": current_level,
        "badges_earned": badges_earned,
        "quests_completed": quests_completed,
    }


@router.get("/users/{user_id}/profile")
async def get_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Basic profile + gamification stats for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Email is PII — only expose it to the user themselves or to staff.
    is_privileged = (
        current_user.id == user.id or current_user.role in ("teacher", "admin")
    )
    return {"success": True, "data": _serialize_user_profile(user, db, is_privileged)}


@router.put("/users/{user_id}/profile")
async def update_user_profile(
    user_id: int,
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update editable profile fields. Only the user (or an admin) may edit."""
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only edit your own profile")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.first_name is not None:
        user.first_name = data.first_name.strip()
    if data.last_name is not None:
        user.last_name = data.last_name.strip()
    if data.bio is not None:
        user.bio = data.bio.strip()

    db.commit()
    db.refresh(user)
    return {"success": True, "data": _serialize_user_profile(user, db, True)}


@router.post("/change-email/request")
async def request_email_change(
    data: ChangeEmailRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Start a verified email change: email a code to the *new* address.

    The address is not changed until the code is confirmed. Google-only
    accounts can't change email here (their email comes from Google).
    """
    new_email = data.new_email.strip().lower()

    if current_user.auth_provider == "google" and not current_user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Your email is managed by Google and can't be changed here.",
        )
    if new_email == (current_user.email or "").lower():
        raise HTTPException(status_code=400, detail="That's already your email address.")

    clash = db.query(User).filter(
        func.lower(User.email) == new_email, User.id != current_user.id
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="That email is already in use.")

    code = _new_verification_code()
    current_user.pending_email = new_email
    current_user.email_change_code = code
    current_user.email_change_expires = _utcnow() + timedelta(
        minutes=VERIFICATION_CODE_EXPIRE_MINUTES
    )
    db.commit()
    send_email_change_code(new_email, code, VERIFICATION_CODE_EXPIRE_MINUTES)
    return {
        "success": True,
        "message": f"A verification code was sent to {new_email}.",
    }


@router.post("/change-email/confirm")
async def confirm_email_change(
    data: ConfirmEmailChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Confirm a pending email change with the code sent to the new address."""
    if not current_user.pending_email or not current_user.email_change_code:
        raise HTTPException(status_code=400, detail="No email change is pending.")
    if (not current_user.email_change_expires
            or current_user.email_change_expires < _utcnow()):
        current_user.pending_email = None
        current_user.email_change_code = None
        current_user.email_change_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Code expired. Start over.")
    if data.code.strip() != current_user.email_change_code:
        raise HTTPException(status_code=400, detail="Incorrect verification code.")

    new_email = current_user.pending_email
    # Re-check uniqueness in case the address was taken since the request.
    clash = db.query(User).filter(
        func.lower(User.email) == new_email.lower(), User.id != current_user.id
    ).first()
    if clash:
        current_user.pending_email = None
        current_user.email_change_code = None
        current_user.email_change_expires = None
        db.commit()
        raise HTTPException(status_code=409, detail="That email is already in use.")

    current_user.email = new_email
    current_user.is_verified = True  # the new address is now proven
    current_user.pending_email = None
    current_user.email_change_code = None
    current_user.email_change_expires = None
    db.commit()
    db.refresh(current_user)
    return {"success": True, "data": _serialize_user_profile(current_user, db, True)}
