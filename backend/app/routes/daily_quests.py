from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import date
import logging

from app.database.connection import get_db
from app.models.user import User
from app.services.daily_quest_service import DailyQuestService
from app.schemas.daily_quest import (
    DailyQuestSummary,
    UserDailyQuestResponse,
    QuestCompletionRequest,
    QuestCompletionResponse
)
from app.models.streak import UserStreak
from app.utils.auth import get_current_active_user, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/daily-quests",
    tags=["daily-quests"],
    responses={404: {"description": "Not found"}},
)


def _resolve_target_user(
    db: Session,
    user_id: int,
    current_user: User,
    *,
    self_only: bool = False,
    staff_only: bool = False,
) -> User:
    """Resolve the target user (by internal id) with an access check.

    Path ids are the internal user id. A user may always act on themselves;
    teachers/admins may read others. Reward-granting actions are self_only.
    """
    is_self = current_user.id == user_id
    is_staff = current_user.role in ("teacher", "admin")
    if self_only and not is_self:
        raise HTTPException(status_code=403, detail="You can only do this for your own account")
    if staff_only and not is_staff:
        raise HTTPException(status_code=403, detail="Teacher or admin only")
    if not (is_self or is_staff):
        raise HTTPException(status_code=403, detail="Not authorized to access this user")
    if is_self:
        return current_user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/seed")
async def seed_daily_quests(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Seed the database with all daily quest templates.
    This should be run once during setup.
    """
    service = DailyQuestService(db)
    try:
        result = service.seed_daily_login_quest()  # This now seeds all quest types
        return result
    except Exception as e:
        logger.error(f"Error seeding daily quests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}", response_model=DailyQuestSummary)
def get_user_daily_quests(
    user_id: int,
    target_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get daily quests for a specific user on a specific date.
    If no date provided, uses today's date. The user_id is the internal user id.
    """
    user = _resolve_target_user(db, user_id, current_user)

    service = DailyQuestService(db)
    
    try:
        # Parse date if provided
        quest_date = None
        if target_date:
            quest_date = date.fromisoformat(target_date)
        
        # Get quest summary using the local user ID (this will auto-generate quests if needed)
        summary = service.get_user_quest_summary(user.id)
        return summary
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        logger.error(f"Error getting user daily quests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user/{user_id}/complete", response_model=QuestCompletionResponse)
async def complete_daily_quest(
    user_id: int,
    request: QuestCompletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Complete a daily quest for the authenticated user (self only — this grants
    rewards). Supports daily_login, feed_pet, and earn_xp quest types.
    """
    user = _resolve_target_user(db, user_id, current_user, self_only=True)

    service = DailyQuestService(db)

    try:
        # Only the "check-in" (daily_login) completes by opening the app. The
        # other quests complete automatically from the real action (submitting a
        # quiz, earning XP) and CANNOT be claimed manually — otherwise they'd be
        # free to cheat with a button click.
        if request.quest_type == "daily_login":
            result = service.complete_daily_login_quest(user.id)
        elif request.quest_type in ("complete_quiz", "earn_xp", "feed_pet"):
            raise HTTPException(
                status_code=400,
                detail="This quest completes automatically when you do the activity.",
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported quest type: {request.quest_type}")
        
        if not result["success"]:
            return QuestCompletionResponse(
                success=False,
                message=result["message"],
                xp_awarded=0
            )
        
        # Convert UserDailyQuest model to response schema
        quest_response = UserDailyQuestResponse.from_orm(result["quest"]) if result.get("quest") else None
        
        return QuestCompletionResponse(
            success=True,
            message=result["message"],
            xp_awarded=result["xp_awarded"],
            quest=quest_response
        )
    except Exception as e:
        logger.error(f"Error completing daily quest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/user/{user_id}/generate")
async def generate_daily_quest_for_user(
    user_id: int,
    target_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Manually generate daily quests for a user on a specific date (staff tool).
    The user_id is the internal user id.
    """
    user = _resolve_target_user(db, user_id, current_user, staff_only=True)

    service = DailyQuestService(db)
    
    try:
        # Parse date if provided
        quest_date = date.today()
        if target_date:
            quest_date = date.fromisoformat(target_date)
        
        # Use the local user ID for the service
        quest = service.generate_daily_login_quest_for_user(user.id, quest_date)
        
        if not quest:
            raise HTTPException(status_code=500, detail="Failed to generate daily quest")
        
        return {
            "success": True,
            "message": f"Daily quest generated for user {user_id} on {quest_date}",
            "quest_id": quest.id
        }
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        logger.error(f"Error generating daily quest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/expire-old")
async def expire_old_quests(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Expire old quests that have passed their expiration time.
    This should be run daily via cron job.
    """
    service = DailyQuestService(db)
    
    try:
        background_tasks.add_task(service.expire_old_quests)
        return {"message": "Old quest expiration task queued"}
    except Exception as e:
        logger.error(f"Error expiring old quests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
async def get_quest_templates(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """
    Get all available daily quest templates.
    """
    from app.models.daily_quest import DailyQuest
    
    try:
        templates = db.query(DailyQuest).filter(DailyQuest.is_active == True).all()
        return {
            "success": True,
            "templates": templates
        }
    except Exception as e:
        logger.error(f"Error getting quest templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/streak")
def get_user_streak(
    user_id: int,
    streak_type: str = "daily_login",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get user's streak information for a specific streak type.
    The user_id is the internal user id.
    """
    user = _resolve_target_user(db, user_id, current_user)

    try:
        # Get user's streak information
        streak = db.query(UserStreak).filter(
            UserStreak.user_id == user.id,
            UserStreak.streak_type == streak_type
        ).first()
        
        if not streak:
            return {
                "success": True,
                "streak": {
                    "current_streak": 0,
                    "longest_streak": 0,
                    "last_activity_date": None,
                    "streak_type": streak_type
                }
            }
        
        return {
            "success": True,
            "streak": {
                "current_streak": streak.current_streak,
                "longest_streak": streak.longest_streak,
                "last_activity_date": streak.last_activity_date.isoformat() if streak.last_activity_date else None,
                "start_date": streak.start_date.isoformat() if streak.start_date else None,
                "streak_type": streak.streak_type
            }
        }
    except Exception as e:
        logger.error(f"Error getting user streak: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/top-streak")
async def get_top_login_streak(
    streak_type: str = "daily_login",
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user),
):
    """
    Get the user with the highest current login streak.
    """
    try:
        from sqlalchemy import desc
        
        # Get the user with the highest current streak
        top_streak = db.query(UserStreak, User).join(
            User, UserStreak.user_id == User.id
        ).filter(
            UserStreak.streak_type == streak_type
        ).order_by(
            desc(UserStreak.current_streak)
        ).first()
        
        if not top_streak:
            return {
                "success": True,
                "user": None,
                "streak": 0,
                "longest_streak": 0
            }
        
        streak, user = top_streak
        
        return {
            "success": True,
            "user": {
                "id": user.moodle_user_id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "profile_image_url": user.profile_image_url
            },
            "streak": streak.current_streak,
            "longest_streak": streak.longest_streak
        }
    except Exception as e:
        logger.error(f"Error getting top login streak: {e}")
        raise HTTPException(status_code=500, detail=str(e))
