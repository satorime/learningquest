"""Native gamification rewards triggered by quest completion.

Phase 3 wires the basic XP + badge path here; Phase 4 extends it (streaks,
virtual pet) and replaces the Moodle-webhook event sources.
"""
import logging
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.quest import Quest, StudentProgress, ExperiencePoints
from app.services.activity_log_service import log_activity

logger = logging.getLogger(__name__)


def grant_quest_completion_reward(
    db: Session,
    user: User,
    quest: Quest,
    score: int | None = None,
    max_score: int | None = None,
) -> int:
    """Award XP for completing a quest and run badge checks.

    XP scales with performance: a student who earns ``score`` out of ``max_score``
    receives that fraction of the quest's ``exp_reward`` (e.g. 6/12 of a 50-XP
    quest = 25 XP). When no usable score is provided (max_score is 0/None), the
    full reward is granted.

    Idempotency is the caller's responsibility (guard on
    QuestSubmission.reward_granted). Returns the XP awarded.
    """
    base = quest.exp_reward or 0
    if max_score and max_score > 0 and score is not None:
        ratio = max(0.0, min(1.0, score / max_score))
        exp = round(base * ratio)
    else:
        exp = base
    course_id = quest.course_id

    # Per-(user, course) progress row.
    progress = db.query(StudentProgress).filter(
        StudentProgress.user_id == user.id,
        StudentProgress.course_id == course_id,
    ).first()
    if progress:
        progress.total_exp = (progress.total_exp or 0) + exp
        progress.quests_completed = (progress.quests_completed or 0) + 1
    else:
        db.add(StudentProgress(
            user_id=user.id,
            course_id=course_id,
            total_exp=exp,
            quests_completed=1,
        ))

    db.add(ExperiencePoints(
        user_id=user.id,
        course_id=course_id or 0,
        amount=exp,
        source_type="quest",
        source_id=quest.quest_id,
    ))

    log_activity(
        db=db,
        user_id=user.id,
        action_type="quest_completed",
        action_details={"quest_id": quest.quest_id, "exp_awarded": exp},
        related_entity_type="quest",
        related_entity_id=quest.quest_id,
        exp_change=exp,
    )

    # Badge evaluation is best-effort.
    try:
        from app.services.badge_service import BadgeService
        BadgeService(db).check_all_badges_for_user(user.id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Badge check failed after quest %s: %s", quest.quest_id, exc)

    # Reward food for doing schoolwork (+5 per completed quiz).
    try:
        from app.services.pet_service import add_food
        add_food(db, user.id, 5)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Food award failed after quest %s: %s", quest.quest_id, exc)

    # Progress the "Keep Studying" (earn XP) daily quest with the XP just earned.
    # ("Knowledge Check" is completed on submission in the quiz route.)
    try:
        from app.services.daily_quest_service import DailyQuestService
        dq = DailyQuestService(db)
        dq.generate_all_daily_quests_for_user(user.id)
        if exp > 0:
            dq.complete_earn_xp_quest(user.id, exp)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Daily quest trigger failed after quest %s: %s", quest.quest_id, exc)

    # Push a live leaderboard refresh to the class (score just changed).
    try:
        if course_id:
            from app.services.realtime import broadcast_to_class
            broadcast_to_class(db, course_id, "leaderboard_update", {"class_id": course_id})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Leaderboard broadcast failed for course %s: %s", course_id, exc)

    return exp
