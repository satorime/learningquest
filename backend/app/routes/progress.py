import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.utils.auth import get_current_active_user
from app.services.progress_service import ProgressService
from app.schemas.progress import (
    ProgressOverviewResponse, DetailedProgressResponse
)
from app.models.activity_log import ActivityLog
from app.models.badge import UserBadge, Badge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/overview", response_model=ProgressOverviewResponse)
async def get_progress_overview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive progress overview for the current user.
    This endpoint provides all the data needed for the progress tracker component.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting progress overview")
        
        progress_service = ProgressService(db)
        
        # Get weekly activity data
        weekly_data = progress_service.get_weekly_activity_data(current_user.id)
        
        # Get monthly activity data
        monthly_data = progress_service.get_monthly_activity_data(current_user.id)
        
        # Get streak data for graph
        streak_data = progress_service.get_streak_data_for_graph(current_user.id)
        
        logger.info(f"Successfully retrieved progress overview for user {current_user.username}")
        
        return ProgressOverviewResponse(
            success=True,
            message="Progress overview retrieved successfully",
            weekly_data=weekly_data,
            monthly_data=monthly_data,
            streak_data=streak_data
        )
        
    except Exception as e:
        logger.error(f"Error getting progress overview for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve progress overview"
        )


@router.get("/detailed", response_model=DetailedProgressResponse)
async def get_detailed_progress(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed progress data including recent activities and badges.
    This provides additional data beyond the basic overview.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting detailed progress")
        
        progress_service = ProgressService(db)
        
        # Get weekly activity data
        weekly_data = progress_service.get_weekly_activity_data(current_user.id)
        
        # Get monthly activity data
        monthly_data = progress_service.get_monthly_activity_data(current_user.id)
        
        # Get streak data for graph
        streak_data = progress_service.get_streak_data_for_graph(current_user.id)
        
        # Get recent activities (last 10)
        recent_activities = db.query(ActivityLog).filter(
            ActivityLog.user_id == current_user.id
        ).order_by(ActivityLog.timestamp.desc()).limit(10).all()
        
        recent_activities_data = []
        for activity in recent_activities:
            recent_activities_data.append({
                "log_id": activity.log_id,
                "action_type": activity.action_type,
                "action_details": activity.action_details,
                "timestamp": activity.timestamp,
                "exp_change": activity.exp_change
            })
        
        # Get recent badges (last 10)
        recent_badges = db.query(UserBadge).join(Badge).filter(
            UserBadge.user_id == current_user.id
        ).order_by(UserBadge.awarded_at.desc()).limit(10).all()
        
        recent_badges_data = []
        for user_badge in recent_badges:
            recent_badges_data.append({
                "badge_id": user_badge.badge.badge_id,
                "name": user_badge.badge.name,
                "description": user_badge.badge.description,
                "badge_type": user_badge.badge.badge_type,
                "image_url": user_badge.badge.image_url,
                "awarded_at": user_badge.awarded_at,
                "exp_value": user_badge.badge.exp_value
            })
        
        logger.info(f"Successfully retrieved detailed progress for user {current_user.username}")
        
        return DetailedProgressResponse(
            success=True,
            message="Detailed progress retrieved successfully",
            weekly_data=weekly_data,
            monthly_data=monthly_data,
            streak_data=streak_data,
            recent_activities=recent_activities_data,
            badges_earned=recent_badges_data
        )
        
    except Exception as e:
        logger.error(f"Error getting detailed progress for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve detailed progress"
        )


@router.get("/overview/{user_id}", response_model=ProgressOverviewResponse)
async def get_progress_overview_by_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get progress overview for a specific user (for teachers/professors).
    """
    try:
        logger.info(f"User {current_user.username} requesting progress overview for user {user_id}")
        
        # Resolve target by internal id first, then legacy moodle id.
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            target_user = db.query(User).filter(User.moodle_user_id == user_id).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Only the user themselves or staff may view a progress overview.
        if current_user.id != target_user.id and current_user.role not in ("teacher", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this user's progress"
            )

        progress_service = ProgressService(db)
        
        # Use the target user's local database ID for progress service calls
        local_user_id = target_user.id
        
        # Get weekly activity data
        weekly_data = progress_service.get_weekly_activity_data(local_user_id)
        
        # Get monthly activity data
        monthly_data = progress_service.get_monthly_activity_data(local_user_id)
        
        # Get streak data for graph
        streak_data = progress_service.get_streak_data_for_graph(local_user_id)
        
        logger.info(f"Successfully retrieved progress overview for user {user_id}")
        
        return ProgressOverviewResponse(
            success=True,
            message=f"Progress overview retrieved successfully for user {target_user.username}",
            weekly_data=weekly_data,
            monthly_data=monthly_data,
            streak_data=streak_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting progress overview for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve progress overview"
        ) 