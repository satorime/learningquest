"""Interactive math mini-games ('Pet Feast').

Problems are generated and graded server-side so scores/rewards can't be faked.
Finishing a session awards pet food + XP (modest, with a daily cap to prevent
grinding). XP flows into the same ExperiencePoints/StudentProgress the pet level
reads from.
"""
import logging
from datetime import date, datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import cast, Date
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.math_game import MathGameSession
from app.models.quest import ExperiencePoints, StudentProgress
from app.services.math_game import generate_problems
from app.services.pet_service import PetService, add_food
from app.utils.auth import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["games"])

PROBLEMS_PER_GAME = 10
SECONDS_PER_QUESTION = 30  # SHS problems need thinking time
DAILY_REWARD_LIMIT = 15  # rewarded sessions per day before rewards stop


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- schemas ----------------------------------------------------------------
class PublicProblem(BaseModel):
    index: int
    prompt: str
    topic: str
    choices: List[str]


class StartResponse(BaseModel):
    session_id: int
    difficulty: int
    seconds_per_question: int
    problems: List[PublicProblem]


class AnswerRequest(BaseModel):
    session_id: int
    index: int
    value: str


class AnswerResponse(BaseModel):
    correct: bool
    correct_value: str
    solution: str


class FinishRequest(BaseModel):
    session_id: int


class FinishResponse(BaseModel):
    correct: int
    total: int
    food_awarded: int
    xp_awarded: int
    food_total: int


# --- endpoints --------------------------------------------------------------
@router.post("/math/start", response_model=StartResponse)
async def start_math_game(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Begin a Pet Feast round: server generates level-scaled problems."""
    level = PetService(db).calculate_user_level(user.id) or 1
    problems = generate_problems(level, PROBLEMS_PER_GAME)

    session = MathGameSession(
        user_id=user.id, difficulty=level, problems=problems,
        total=len(problems), status="pending",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return StartResponse(
        session_id=session.id,
        difficulty=level,
        seconds_per_question=SECONDS_PER_QUESTION,
        problems=[
            PublicProblem(
                index=i, prompt=p["prompt"],
                topic=p.get("topic", "Math"), choices=p["choices"],
            )
            for i, p in enumerate(problems)
        ],
    )


@router.post("/math/answer", response_model=AnswerResponse)
async def answer_math_question(
    data: AnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Record one answer and report whether it was correct (for live feedback).

    The answer is stored server-side; the correct value is only revealed for the
    question just answered (which can no longer be changed), so it can't be used
    to cheat the score.
    """
    session = db.query(MathGameSession).filter(
        MathGameSession.id == data.session_id,
        MathGameSession.user_id == user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    if session.status == "finished":
        raise HTTPException(status_code=409, detail="This game is already finished")
    if data.index < 0 or data.index >= len(session.problems):
        raise HTTPException(status_code=400, detail="Invalid question index")

    responses = dict(session.responses or {})
    key = str(data.index)
    if key in responses:
        raise HTTPException(status_code=409, detail="Question already answered")

    problem = session.problems[data.index]
    responses[key] = data.value
    session.responses = responses  # reassign so SQLAlchemy tracks the JSONB change
    db.commit()

    return AnswerResponse(
        correct=data.value == problem["answer"],
        correct_value=problem["answer"],
        solution=problem.get("solution", ""),
    )


@router.post("/math/finish", response_model=FinishResponse)
async def finish_math_game(
    data: FinishRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Grade a round from the server-recorded answers and award food + XP once."""
    session = db.query(MathGameSession).filter(
        MathGameSession.id == data.session_id,
        MathGameSession.user_id == user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    if session.status == "finished":
        raise HTTPException(status_code=409, detail="This game was already finished")

    responses = session.responses or {}
    correct = sum(
        1 for i, p in enumerate(session.problems) if responses.get(str(i)) == p["answer"]
    )

    # Daily cap: only the first N rewarded games per day grant food/XP.
    rewarded_today = db.query(MathGameSession).filter(
        MathGameSession.user_id == user.id,
        MathGameSession.status == "finished",
        MathGameSession.food_awarded > 0,
        cast(MathGameSession.finished_at, Date) == date.today(),
    ).count()

    # Rewards scale with how many they answered correctly:
    #   XP  = 5 per correct  (10/10 -> 50 XP, matching the daily "earn 50 XP")
    #   food = ~1 per 2 correct, so even 1 correct earns a treat (max 5)
    if rewarded_today < DAILY_REWARD_LIMIT:
        xp = correct * 5
        food = min(5, (correct + 1) // 2)
    else:
        xp, food = 0, 0

    session.status = "finished"
    session.correct_count = correct
    session.food_awarded = food
    session.xp_awarded = xp
    session.finished_at = _utcnow()
    db.commit()

    if xp:
        db.add(ExperiencePoints(
            user_id=user.id, course_id=0, amount=xp,
            source_type="math_game", awarded_at=_utcnow(),
            notes="Pet Feast math game",
        ))
        prog = db.query(StudentProgress).filter(
            StudentProgress.user_id == user.id,
            StudentProgress.course_id.is_(None),
        ).first()
        if prog:
            prog.total_exp = (prog.total_exp or 0) + xp
            prog.last_activity = _utcnow()
        else:
            db.add(StudentProgress(
                user_id=user.id, course_id=None, total_exp=xp,
                last_activity=_utcnow(),
            ))
        db.commit()

    food_total = add_food(db, user.id, food) if food else 0
    if not food:
        # Still report the current food total for the UI.
        from app.models.virtual_pet import VirtualPet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == user.id).first()
        food_total = pet.food if pet else 0

    return FinishResponse(
        correct=correct, total=session.total,
        food_awarded=food, xp_awarded=xp, food_total=food_total,
    )
