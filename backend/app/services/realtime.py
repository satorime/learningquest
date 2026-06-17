"""Real-time push helpers built on the in-memory SSE notification service.

Single-process / single-worker only (the SSE registry lives in memory). That's
the intended deployment for this app; a multi-instance deploy would need a shared
broker. Broadcasts are best-effort: if no event loop is running (e.g. called from
a sync worker thread) they're skipped, and the data is still correct on next fetch.
"""
import asyncio
import logging
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.enrollment import CourseEnrollment
from app.services.notification_service import notification_service, NotificationData

logger = logging.getLogger(__name__)

# The main asyncio loop, captured at startup, so we can push SSE events even from
# synchronous endpoints (which FastAPI runs in a threadpool with no running loop).
_main_loop = None


def set_main_loop(loop) -> None:
    """Record the app's event loop (called once on startup)."""
    global _main_loop
    _main_loop = loop


def _schedule_send(notification) -> None:
    """Schedule an SSE send from any context — async handler or sync threadpool.

    Best-effort: if there's no usable loop the push is skipped and the data is
    still correct on the client's next fetch.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(notification_service.send_notification(notification))
        return
    except RuntimeError:
        pass  # not in an async context — fall back to the captured loop

    if _main_loop is not None and _main_loop.is_running():
        try:
            asyncio.run_coroutine_threadsafe(
                notification_service.send_notification(notification), _main_loop
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not schedule SSE send: %s", exc)


def notify_badge_awarded(user_id: int, badge, awarded_by=None) -> None:
    """Push a 'badge_awarded' SSE so the student gets a live popup of the badge."""
    if not badge:
        return
    criteria = getattr(badge, "criteria", None) or {}
    payload = {
        "badge_id": getattr(badge, "badge_id", None),
        "name": getattr(badge, "name", "Badge"),
        "description": getattr(badge, "description", "") or "",
        "icon": criteria.get("icon", "award"),
        "color": criteria.get("color", "amber"),
        "shape": criteria.get("shape", "circle"),
        "exp_value": getattr(badge, "exp_value", 0) or 0,
        "badge_type": getattr(badge, "badge_type", "achievement"),
        "is_custom": getattr(badge, "badge_type", "") == "custom",
        "awarded_by": awarded_by,
    }
    notification = NotificationData(
        notification_type="badge_awarded",
        user_id=user_id,
        title="Badge earned!",
        message=payload["name"],
        quest_data=payload,
    )
    _schedule_send(notification)


def broadcast_to_class(
    db: Session, course_id: int, event_type: str, payload: Dict[str, Any]
) -> None:
    """Push an SSE event to every active student in a class.

    `event_type` becomes the SSE notification `type`; `payload` rides in
    `quest_data` for the frontend to act on (e.g. {"class_id": ...}).
    """
    if not course_id:
        return

    user_ids = [
        e.user_id
        for e in db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.status == "active",
        ).all()
    ]
    if not user_ids:
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop (sync context) — skip the live push.
        return

    for uid in user_ids:
        notification = NotificationData(
            notification_type=event_type,
            user_id=uid,
            title="",
            message="",
            quest_data=payload,
        )
        loop.create_task(notification_service.send_notification(notification))


def broadcast_to_race(db: Session, room_id: int, payload: Dict[str, Any] | None = None) -> None:
    """Push a 'race_update' SSE signal to every player in a race room.

    Clients treat it as 'refetch the room state' (same pattern as leaderboards).
    """
    from app.models.race import RacePlayer  # local import to avoid a cycle

    user_ids = [
        p.user_id
        for p in db.query(RacePlayer).filter(RacePlayer.room_id == room_id).all()
    ]
    if not user_ids:
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    data = {"room_id": room_id, **(payload or {})}
    for uid in user_ids:
        notification = NotificationData(
            notification_type="race_update",
            user_id=uid,
            title="",
            message="",
            quest_data=data,
        )
        loop.create_task(notification_service.send_notification(notification))
