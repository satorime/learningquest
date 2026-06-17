"""Teacher Google Drive connection (OAuth) endpoints.

The teacher connects their own Drive once; we store an encrypted refresh token
and a root folder id. Student submission files are then uploaded into that
teacher's Drive (see services/drive_storage.py).
"""
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import FRONTEND_URL
from app.database.connection import get_db
from app.models.user import User
from app.models.drive import TeacherDriveConnection
from app.services import google_drive as gd
from app.utils.auth import (
    get_current_active_user,
    get_role_required,
    create_access_token,
    decode_token,
)
from app.utils.crypto import encrypt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive", tags=["drive"])

_STATE_PURPOSE = "drive_oauth"


@router.get("/status")
def drive_status(
    teacher: User = Depends(get_role_required("teacher")),
    db: Session = Depends(get_db),
):
    """Whether the current teacher has connected Drive (and basic details)."""
    conn = (
        db.query(TeacherDriveConnection)
        .filter(TeacherDriveConnection.user_id == teacher.id)
        .first()
    )
    return {
        "configured": gd.is_configured(),
        "connected": conn is not None,
        "email": conn.google_email if conn else None,
        "folder_link": gd.folder_link(conn.root_folder_id) if conn and conn.root_folder_id else None,
    }


@router.get("/connect")
def drive_connect(
    teacher: User = Depends(get_role_required("teacher")),
):
    """Return the Google consent URL the teacher's browser should navigate to."""
    if not gd.is_configured():
        raise HTTPException(status_code=503, detail="Google Drive is not configured on the server.")
    # Signed, short-lived state carries the teacher id to the (unauthenticated)
    # callback below.
    state = create_access_token(
        {"sub": str(teacher.id), "purpose": _STATE_PURPOSE},
        expires_delta=timedelta(minutes=10),
    )
    return {"url": gd.consent_url(state)}


@router.get("/callback")
def drive_callback(
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Google redirects here after consent. Validate state, store the token,
    then bounce the teacher back to their settings page."""
    dest = f"{FRONTEND_URL}/teacher/profile"
    if error or not code or not state:
        return RedirectResponse(f"{dest}?drive=error")

    payload = decode_token(state)
    if not payload or payload.get("purpose") != _STATE_PURPOSE:
        return RedirectResponse(f"{dest}?drive=error")
    try:
        teacher_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return RedirectResponse(f"{dest}?drive=error")

    try:
        tokens = gd.exchange_code(code)
        access = tokens["access_token"]
        root_id = gd.ensure_folder(access, "LearningQuest", None)
    except Exception as exc:  # noqa: BLE001
        logger.error("Drive callback failed for teacher %s: %s", teacher_id, exc)
        return RedirectResponse(f"{dest}?drive=error")

    conn = (
        db.query(TeacherDriveConnection)
        .filter(TeacherDriveConnection.user_id == teacher_id)
        .first()
    )
    if conn:
        conn.refresh_token_enc = encrypt(tokens["refresh_token"])
        conn.google_email = tokens.get("email")
        conn.root_folder_id = root_id
    else:
        db.add(TeacherDriveConnection(
            user_id=teacher_id,
            google_email=tokens.get("email"),
            refresh_token_enc=encrypt(tokens["refresh_token"]),
            root_folder_id=root_id,
        ))
    db.commit()
    return RedirectResponse(f"{dest}?drive=connected")


@router.post("/disconnect")
def drive_disconnect(
    teacher: User = Depends(get_role_required("teacher")),
    db: Session = Depends(get_db),
):
    conn = (
        db.query(TeacherDriveConnection)
        .filter(TeacherDriveConnection.user_id == teacher.id)
        .first()
    )
    if conn:
        db.delete(conn)
        db.commit()
    return {"success": True}


class RootFolderRequest(BaseModel):
    folder_id: str


@router.post("/root-folder")
def drive_set_root(
    data: RootFolderRequest,
    teacher: User = Depends(get_role_required("teacher")),
    db: Session = Depends(get_db),
):
    """Use an existing folder (e.g. picked via the Google Picker) as the root."""
    conn = (
        db.query(TeacherDriveConnection)
        .filter(TeacherDriveConnection.user_id == teacher.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=409, detail="Connect Google Drive first.")
    conn.root_folder_id = data.folder_id.strip()
    db.commit()
    return {"success": True, "folder_link": gd.folder_link(conn.root_folder_id)}
