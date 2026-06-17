"""Admin routes: teacher provisioning, user role administration, platform
settings, and activity monitoring. All endpoints require the admin role.
"""
from datetime import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.models.setting import PlatformSetting
from app.schemas.auth import (
    UserResponse,
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
)
from app.utils.auth import require_admin, get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = {"student", "teacher", "admin"}


# --- user management --------------------------------------------------------
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    role: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search username/email/name"),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            User.username.ilike(like),
            User.email.ilike(like),
            User.first_name.ilike(like),
            User.last_name.ilike(like),
        ))
    return query.order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Create a teacher (or student/admin) account."""
    if data.role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail="Invalid role")
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
        role=data.role,
        auth_provider="local",
        is_active=True,
        is_verified=True,  # admin-provisioned accounts are trusted
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: AdminUpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.role is not None:
        if data.role not in VALID_ROLES:
            raise HTTPException(status_code=422, detail="Invalid role")
        user.role = data.role
    if data.email is not None:
        clash = db.query(User).filter(
            User.email == data.email, User.id != user.id
        ).first()
        if clash:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = data.email
    if data.first_name is not None:
        user.first_name = data.first_name
    if data.last_name is not None:
        user.last_name = data.last_name
    if data.is_active is not None:
        if user.id == admin.id and data.is_active is False:
            raise HTTPException(status_code=400, detail="Admins cannot deactivate themselves")
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return user


def _set_role(db: Session, admin: User, user_id: int, role: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/promote", response_model=UserResponse)
async def promote_to_teacher(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    """Grant the teacher role."""
    return _set_role(db, admin, user_id, "teacher")


@router.post("/users/{user_id}/demote", response_model=UserResponse)
async def demote_to_student(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    """Revoke the teacher role (back to student)."""
    return _set_role(db, admin, user_id, "student")


@router.post("/users/{user_id}/deactivate", response_model=UserResponse)
async def deactivate_user(
    user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Admins cannot deactivate themselves")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/activate", response_model=UserResponse)
async def activate_user(
    user_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


# --- activity monitoring ----------------------------------------------------
@router.get("/activity")
async def recent_activity(
    limit: int = Query(50, le=500),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(ActivityLog)
    if user_id is not None:
        query = query.filter(ActivityLog.user_id == user_id)
    logs = query.order_by(ActivityLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "log_id": l.log_id,
            "user_id": l.user_id,
            "action_type": l.action_type,
            "action_details": l.action_details,
            "related_entity_type": l.related_entity_type,
            "related_entity_id": l.related_entity_id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in logs
    ]


@router.get("/stats")
async def platform_stats(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    """High-level platform usage counts for the admin dashboard."""
    return {
        "total_users": db.query(User).count(),
        "students": db.query(User).filter(User.role == "student").count(),
        "teachers": db.query(User).filter(User.role == "teacher").count(),
        "admins": db.query(User).filter(User.role == "admin").count(),
        "active_users": db.query(User).filter(User.is_active == True).count(),
    }


# --- platform settings ------------------------------------------------------
@router.get("/settings")
async def get_settings(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    return {s.key: s.value for s in db.query(PlatformSetting).all()}


@router.put("/settings/{key}")
async def set_setting(
    key: str, payload: dict, db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Upsert a single platform setting. Body: {"value": <any>}."""
    value = payload.get("value")
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = PlatformSetting(key=key, value=value)
        db.add(setting)
    db.commit()
    return {"key": key, "value": value}
