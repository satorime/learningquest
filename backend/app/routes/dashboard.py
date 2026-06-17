"""Aggregated dashboard data.

The student dashboard used to fire ~10 separate requests on load (quizzes,
classes, progress, pet, streak, daily quests, badges). Over a remote DB each is
its own round-trip and the browser only opens ~6 connections at once, so they
queued into multiple waves. This endpoint returns everything in ONE response,
computed on the server's warm connection.

It deliberately reuses the existing (now-synchronous) route handlers so there's
no duplicated query logic to drift out of sync. Each section is isolated: if one
fails, its slot is null/empty and the rest of the dashboard still loads. The
frontend falls back to the individual endpoints if this call fails entirely.
"""
import logging
from typing import Any, Callable

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.utils.auth import get_current_active_user

from app.routes.quiz import available_quests
from app.routes.classes import my_enrolled_classes
from app.routes.daily_quests import get_user_streak
from app.routes.virtual_pet import get_my_pet
from app.routes.quests import get_student_progress

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _safe(label: str, fn: Callable[[], Any], db: Session, default: Any = None) -> Any:
    """Run one section; on any failure return `default` so one bad slot can't
    500 the whole dashboard.

    Critically, roll the shared session back on error: a failed query otherwise
    leaves the session unusable and every following section would cascade-fail.
    """
    try:
        return fn()
    except Exception as exc:  # noqa: BLE001 - per-section isolation is intentional
        logger.warning("dashboard summary: '%s' section failed: %s", label, exc)
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        return default


@router.get("/summary")
def dashboard_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """The page-level data the student dashboard renders, in one response.

    (The pet widget, daily-quests card, and class leaderboard self-fetch their
    own data — including the daily check-in side effect — so they're not folded
    in here.)
    """
    uid = current_user.id
    return {
        "quizzes": _safe(
            "quizzes", lambda: available_quests(db=db, user=current_user), db, []
        ),
        "classes": _safe(
            "classes", lambda: my_enrolled_classes(db=db, user=current_user), db, []
        ),
        "progress": _safe(
            "progress",
            lambda: get_student_progress(user_id=uid, db=db, current_user=current_user),
            db,
        ),
        "pet": _safe(
            "pet", lambda: get_my_pet(current_user=current_user, db=db), db
        ),
        "streak": _safe(
            "streak",
            lambda: get_user_streak(user_id=uid, db=db, current_user=current_user),
            db,
        ),
    }
