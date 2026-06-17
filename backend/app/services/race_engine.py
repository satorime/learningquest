"""Authoritative server-side game loop for Math Duck Race.

In the original Duck Math the host *phone* drove the round resolution; here the
FastAPI server is the single source of truth. One asyncio task per active room
runs the question loop, waking either when the first correct answer "locks" the
question (via an asyncio.Event signalled from the answer endpoint) or when the
per-question timer expires.

Single-worker only (in-memory task/event registries) — same assumption as SSE.
A server restart mid-race ends that race.
"""
import asyncio
import logging
from datetime import date, datetime, timezone

from sqlalchemy import cast, Date

from app.database.connection import SessionLocal
from app.models.race import RaceRoom, RacePlayer
from app.services.realtime import broadcast_to_race

logger = logging.getLogger(__name__)

LOCK_RESOLVE_DELAY = 2.0  # seconds to show the round winner before the next question
DAILY_RACE_REWARD_LIMIT = 10  # rewarded races per user per day (anti-farming)

_events: dict[int, asyncio.Event] = {}
_tasks: dict[int, asyncio.Task] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def signal_lock(room_id: int) -> None:
    """Wake the room's loop immediately (a correct answer locked the question)."""
    ev = _events.get(room_id)
    if ev is not None:
        ev.set()


def _broadcast(room_id: int) -> None:
    db = SessionLocal()
    try:
        broadcast_to_race(db, room_id)
    finally:
        db.close()


def _grant_rewards(db, room: RaceRoom) -> None:
    """Winner gets food + XP; everyone who played gets a little XP. Once per room."""
    from app.models.quest import ExperiencePoints, StudentProgress
    from app.services.pet_service import add_food

    players = db.query(RacePlayer).filter(
        RacePlayer.room_id == room.id, RacePlayer.is_host == False  # noqa: E712
    ).all()
    for p in players:
        # Cap rewards so repeated races can't be farmed for food/XP.
        rewarded_today = db.query(ExperiencePoints).filter(
            ExperiencePoints.user_id == p.user_id,
            ExperiencePoints.source_type == "duck_race",
            cast(ExperiencePoints.awarded_at, Date) == date.today(),
        ).count()
        if rewarded_today >= DAILY_RACE_REWARD_LIMIT:
            continue

        is_winner = room.winner_id is not None and p.user_id == room.winner_id
        xp = 40 if is_winner else 10
        db.add(ExperiencePoints(
            user_id=p.user_id, course_id=0, amount=xp,
            source_type="duck_race", awarded_at=_utcnow(),
            notes="Math Duck Race",
        ))
        prog = db.query(StudentProgress).filter(
            StudentProgress.user_id == p.user_id,
            StudentProgress.course_id.is_(None),
        ).first()
        if prog:
            prog.total_exp = (prog.total_exp or 0) + xp
            prog.last_activity = _utcnow()
        else:
            db.add(StudentProgress(user_id=p.user_id, course_id=None, total_exp=xp,
                                   last_activity=_utcnow()))
        if is_winner:
            try:
                add_food(db, p.user_id, 3)
            except Exception:  # noqa: BLE001
                pass


def _finish(db, room: RaceRoom) -> None:
    room.status = "finished"
    room.ended_at = _utcnow()
    if not room.rewards_granted:
        try:
            _grant_rewards(db, room)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Race reward grant failed for room %s: %s", room.id, exc)
        room.rewards_granted = True


async def start_race(room_id: int) -> None:
    """Launch the loop task (called from the async /start endpoint)."""
    if room_id in _tasks and not _tasks[room_id].done():
        return
    _events[room_id] = asyncio.Event()
    _tasks[room_id] = asyncio.create_task(run_race(room_id))


async def run_race(room_id: int) -> None:
    try:
        while True:
            # 1) Present the current question.
            db = SessionLocal()
            try:
                room = db.query(RaceRoom).filter(RaceRoom.id == room_id).first()
                if not room or room.status != "playing":
                    return
                order = room.question_order or []
                if room.current_index >= len(order):
                    _finish(db, room)
                    db.commit()
                    _broadcast(room_id)
                    return
                room.current_started_at = _utcnow()
                room.locked_at = None
                room.locked_by = None
                db.commit()
                time_per_question = room.time_per_question
            finally:
                db.close()
            _broadcast(room_id)

            # 2) Wait for the first correct answer (lock) or the timer.
            ev = _events.get(room_id) or asyncio.Event()
            _events[room_id] = ev
            ev.clear()
            try:
                await asyncio.wait_for(ev.wait(), timeout=time_per_question)
                locked = True
            except asyncio.TimeoutError:
                locked = False
            if locked:
                await asyncio.sleep(LOCK_RESOLVE_DELAY)  # let everyone see the winner

            # 3) Resolve the round and advance (or finish).
            db = SessionLocal()
            try:
                room = db.query(RaceRoom).filter(RaceRoom.id == room_id).first()
                if not room or room.status != "playing":
                    return
                if room.locked_by:
                    winner = db.query(RacePlayer).filter(
                        RacePlayer.room_id == room_id,
                        RacePlayer.user_id == room.locked_by,
                    ).first()
                    if winner:
                        winner.tile += 1
                        winner.score += 1
                        if winner.tile >= room.total_tiles:
                            room.winner_id = winner.user_id
                            _finish(db, room)
                            db.commit()
                            _broadcast(room_id)
                            return
                room.current_index += 1
                if room.current_index >= len(room.question_order or []):
                    _finish(db, room)
                    db.commit()
                    _broadcast(room_id)
                    return
                db.commit()
            finally:
                db.close()
            # loop to next question
    except asyncio.CancelledError:
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("Race loop crashed for room %s: %s", room_id, exc)
    finally:
        _tasks.pop(room_id, None)
        _events.pop(room_id, None)
