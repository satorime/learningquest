"""Math Duck Race — multiplayer race endpoints.

Teacher creates a room from one of their quizzes; students join by code, ready up,
and race. The server (race_engine) is the authoritative game loop. State is read
via GET /race/rooms/{id}/state; clients refetch on the 'race_update' SSE signal.
"""
import logging
import random
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.quest import Quest
from app.models.quiz import QuizQuestion, QuizOption
from app.models.enrollment import CourseEnrollment
from app.models.race import RaceRoom, RacePlayer, RaceAnswer
from app.services import race_engine
from app.services.realtime import broadcast_to_race
from app.utils.auth import get_current_active_user, require_teacher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/race", tags=["race"])

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DUCK_COLORS = ["yellow", "orange", "pink", "blue", "green", "purple", "red"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not db.query(RaceRoom).filter(RaceRoom.code == code).first():
            return code
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))


def _display_name(u: User) -> str:
    full = f"{u.first_name or ''} {u.last_name or ''}".strip()
    return full or u.username


def _pick_color(db: Session, room_id: int) -> str:
    taken = {
        p.duck_color
        for p in db.query(RacePlayer).filter(RacePlayer.room_id == room_id).all()
    }
    free = [c for c in DUCK_COLORS if c not in taken]
    return random.choice(free) if free else random.choice(DUCK_COLORS)


def _grade(question: QuizQuestion, answer: str) -> bool:
    if question.type in ("multiple_choice", "true_false"):
        try:
            oid = int(answer)
        except (TypeError, ValueError):
            return False
        opt = next((o for o in question.options if o.id == oid), None)
        return bool(opt and opt.is_correct)
    if question.type == "short_answer" and question.correct_answer:
        return (answer or "").strip().lower() == question.correct_answer.strip().lower()
    return False


def _require_room(db: Session, room_id: int) -> RaceRoom:
    room = db.query(RaceRoom).filter(RaceRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Race room not found")
    return room


def _my_player(db: Session, room_id: int, user_id: int) -> Optional[RacePlayer]:
    return db.query(RacePlayer).filter(
        RacePlayer.room_id == room_id, RacePlayer.user_id == user_id
    ).first()


def _state(db: Session, room: RaceRoom, user: User) -> dict:
    players = db.query(RacePlayer).filter(RacePlayer.room_id == room.id).all()
    ranked = sorted(players, key=lambda p: (-p.tile, -p.score, -p.correct_answers))
    order = room.question_order or []

    current_question = None
    already_answered = False
    if room.status == "playing" and 0 <= room.current_index < len(order):
        qid = order[room.current_index]
        q = db.query(QuizQuestion).filter(QuizQuestion.id == qid).first()
        if q:
            current_question = {
                "index": room.current_index,
                "prompt": q.prompt,
                "type": q.type,
                "choices": [
                    {"id": o.id, "text": o.text}
                    for o in sorted(q.options, key=lambda o: o.position)
                ] if q.type in ("multiple_choice", "true_false") else [],
            }
            already_answered = db.query(RaceAnswer).filter(
                RaceAnswer.room_id == room.id,
                RaceAnswer.question_index == room.current_index,
                RaceAnswer.user_id == user.id,
            ).first() is not None

    locked_by_name = None
    if room.locked_by:
        lp = next((p for p in players if p.user_id == room.locked_by), None)
        locked_by_name = lp.display_name if lp else None

    return {
        "room": {
            "id": room.id,
            "code": room.code,
            "host_id": room.host_id,
            "quiz_id": room.quiz_id,
            "status": room.status,
            "total_tiles": room.total_tiles,
            "time_per_question": room.time_per_question,
            "max_players": room.max_players,
            "current_index": room.current_index,
            "total_questions": len(order),
            "current_started_at": room.current_started_at.isoformat() if room.current_started_at else None,
            "locked": room.locked_by is not None,
            "locked_by": room.locked_by,
            "locked_by_name": locked_by_name,
            "winner_id": room.winner_id,
        },
        "players": [
            {
                "user_id": p.user_id,
                "display_name": p.display_name,
                "duck_color": p.duck_color,
                "tile": p.tile,
                "score": p.score,
                "is_ready": p.is_ready,
                "is_host": p.is_host,
                "correct_answers": p.correct_answers,
                "wrong_answers": p.wrong_answers,
            }
            for p in ranked
        ],
        "current_question": current_question,
        "me": {
            "user_id": user.id,
            "is_host": room.host_id == user.id,
            "already_answered": already_answered,
        },
        "server_now": _utcnow().isoformat(),
    }


# --- schemas ----------------------------------------------------------------
class CreateRoomBody(BaseModel):
    quiz_id: int
    total_tiles: int = Field(default=10, ge=3, le=30)
    time_per_question: int = Field(default=30, ge=10, le=120)
    max_players: int = Field(default=30, ge=2, le=50)


class JoinBody(BaseModel):
    code: str


class ReadyBody(BaseModel):
    is_ready: bool
    duck_color: Optional[str] = None


class AnswerBody(BaseModel):
    answer: str


# --- teacher: create / start / close ----------------------------------------
@router.post("/rooms", status_code=status.HTTP_201_CREATED)
async def create_room(
    data: CreateRoomBody,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    quiz = db.query(Quest).filter(Quest.quest_id == data.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if teacher.role != "admin" and quiz.creator_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not your quiz")
    q_count = db.query(QuizQuestion).filter(QuizQuestion.quest_id == quiz.quest_id).count()
    if q_count == 0:
        raise HTTPException(status_code=400, detail="That quiz has no questions yet")

    room = RaceRoom(
        code=_gen_code(db),
        host_id=teacher.id,
        quiz_id=quiz.quest_id,
        total_tiles=data.total_tiles,
        time_per_question=data.time_per_question,
        max_players=data.max_players,
        status="waiting",
        question_order=[],
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    # Host joins as a white observer duck so they can watch the track.
    db.add(RacePlayer(
        room_id=room.id, user_id=teacher.id, display_name=f"{_display_name(teacher)} (Teacher)",
        duck_color="white", is_ready=True, is_host=True,
    ))
    db.commit()
    return _state(db, room, teacher)


@router.post("/rooms/{room_id}/start")
async def start_room(
    room_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    room = _require_room(db, room_id)
    if room.host_id != teacher.id and teacher.role != "admin":
        raise HTTPException(status_code=403, detail="Only the host can start")
    if room.status != "waiting":
        raise HTTPException(status_code=409, detail="Race already started")

    racers = db.query(RacePlayer).filter(
        RacePlayer.room_id == room_id, RacePlayer.is_host == False  # noqa: E712
    ).all()
    ready = [p for p in racers if p.is_ready]
    if len(ready) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 ready players to start")

    questions = db.query(QuizQuestion).filter(
        QuizQuestion.quest_id == room.quiz_id
    ).all()
    qids = [q.id for q in questions]
    random.shuffle(qids)

    room.question_order = qids
    room.current_index = 0
    room.status = "playing"
    room.started_at = _utcnow()
    db.commit()

    await race_engine.start_race(room.id)
    return _state(db, room, teacher)


@router.post("/rooms/{room_id}/close", status_code=status.HTTP_200_OK)
async def close_room(
    room_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    room = _require_room(db, room_id)
    if room.host_id != teacher.id and teacher.role != "admin":
        raise HTTPException(status_code=403, detail="Only the host can close")
    room.status = "finished"
    room.ended_at = _utcnow()
    db.commit()
    task = race_engine._tasks.get(room_id)
    if task and not task.done():
        task.cancel()
    broadcast_to_race(db, room_id)
    return {"status": "closed"}


# --- student: join / ready / answer -----------------------------------------
@router.post("/join")
async def join_room(
    data: JoinBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    code = data.code.strip().upper()
    room = db.query(RaceRoom).filter(RaceRoom.code == code).first()
    if not room:
        raise HTTPException(status_code=404, detail="No race found for that code")

    existing = _my_player(db, room.id, user.id)
    if existing:
        return _state(db, room, user)  # rejoin

    if room.status != "waiting":
        raise HTTPException(status_code=409, detail="This race has already started")

    # Only students enrolled in the quiz's class may join (teachers/admins exempt).
    quiz = db.query(Quest).filter(Quest.quest_id == room.quiz_id).first()
    if (
        quiz and quiz.course_id
        and user.id != room.host_id
        and user.role not in ("teacher", "admin")
    ):
        enrolled = db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id == quiz.course_id,
            CourseEnrollment.user_id == user.id,
            CourseEnrollment.status == "active",
        ).first()
        if not enrolled:
            raise HTTPException(
                status_code=403,
                detail="You must be enrolled in this class to join the race",
            )
    count = db.query(RacePlayer).filter(RacePlayer.room_id == room.id).count()
    if count >= room.max_players + 1:  # +1 for host
        raise HTTPException(status_code=409, detail="Room is full")

    db.add(RacePlayer(
        room_id=room.id, user_id=user.id, display_name=_display_name(user),
        duck_color=_pick_color(db, room.id), is_ready=False, is_host=False,
    ))
    db.commit()
    broadcast_to_race(db, room.id)
    return _state(db, room, user)


@router.post("/rooms/{room_id}/ready")
async def set_ready(
    room_id: int,
    data: ReadyBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    room = _require_room(db, room_id)
    player = _my_player(db, room_id, user.id)
    if not player or player.is_host:
        raise HTTPException(status_code=403, detail="Not a racer in this room")
    if room.status != "waiting":
        raise HTTPException(status_code=409, detail="Race already started")
    player.is_ready = data.is_ready
    if data.duck_color and data.duck_color in DUCK_COLORS:
        player.duck_color = data.duck_color
    db.commit()
    broadcast_to_race(db, room_id)
    return _state(db, room, user)


@router.post("/rooms/{room_id}/answer")
async def submit_answer(
    room_id: int,
    data: AnswerBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    room = _require_room(db, room_id)
    player = _my_player(db, room_id, user.id)
    if not player or player.is_host:
        raise HTTPException(status_code=403, detail="Not a racer in this room")
    if room.status != "playing":
        raise HTTPException(status_code=409, detail="The race is not active")
    if room.locked_by is not None:
        raise HTTPException(status_code=409, detail="Someone already answered this one")

    order = room.question_order or []
    idx = room.current_index
    if idx >= len(order):
        raise HTTPException(status_code=409, detail="No active question")
    q = db.query(QuizQuestion).filter(QuizQuestion.id == order[idx]).first()
    if not q:
        raise HTTPException(status_code=500, detail="Question missing")

    dup = db.query(RaceAnswer).filter(
        RaceAnswer.room_id == room_id, RaceAnswer.question_index == idx,
        RaceAnswer.user_id == user.id,
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail="You already answered this question")

    is_correct = _grade(q, data.answer)
    response_ms = 0
    if room.current_started_at:
        started = room.current_started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        response_ms = int((_utcnow() - started).total_seconds() * 1000)

    db.add(RaceAnswer(
        room_id=room_id, question_index=idx, user_id=user.id,
        answer=data.answer, is_correct=is_correct, response_ms=response_ms,
    ))
    if is_correct:
        player.correct_answers += 1
        if room.locked_by is None:
            room.locked_by = user.id
            room.locked_at = _utcnow()
            db.commit()
            race_engine.signal_lock(room_id)  # wake the loop to resolve now
        else:
            db.commit()
    else:
        player.wrong_answers += 1
        db.commit()

    return {"correct": is_correct, "locked_by": room.locked_by}


# --- shared: state / results ------------------------------------------------
@router.get("/rooms/{room_id}/state")
async def get_state(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    room = _require_room(db, room_id)
    if not _my_player(db, room_id, user.id) and room.host_id != user.id:
        raise HTTPException(status_code=403, detail="You are not in this race")
    return _state(db, room, user)


@router.get("/rooms/{room_id}/results")
async def get_results(
    room_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    room = _require_room(db, room_id)
    if not _my_player(db, room_id, user.id) and room.host_id != user.id:
        raise HTTPException(status_code=403, detail="You are not in this race")

    players = db.query(RacePlayer).filter(
        RacePlayer.room_id == room_id, RacePlayer.is_host == False  # noqa: E712
    ).all()
    ranked = sorted(players, key=lambda p: (-p.tile, -p.score, -p.correct_answers))

    # Per-question analytics (teacher view).
    order = room.question_order or []
    answers = db.query(RaceAnswer).filter(RaceAnswer.room_id == room_id).all()
    stats = []
    for i, qid in enumerate(order):
        subs = [a for a in answers if a.question_index == i]
        if not subs:
            continue
        q = db.query(QuizQuestion).filter(QuizQuestion.id == qid).first()
        correct = [a for a in subs if a.is_correct]
        stats.append({
            "index": i,
            "prompt": q.prompt if q else f"Question {i + 1}",
            "correct_count": len(correct),
            "wrong_count": len(subs) - len(correct),
        })

    return {
        "room": {"id": room.id, "code": room.code, "status": room.status,
                 "winner_id": room.winner_id, "total_tiles": room.total_tiles},
        "standings": [
            {
                "rank": i + 1,
                "user_id": p.user_id,
                "display_name": p.display_name,
                "duck_color": p.duck_color,
                "tile": p.tile,
                "score": p.score,
                "correct_answers": p.correct_answers,
                "wrong_answers": p.wrong_answers,
                "is_winner": p.user_id == room.winner_id,
            }
            for i, p in enumerate(ranked)
        ],
        "question_stats": stats,
    }
