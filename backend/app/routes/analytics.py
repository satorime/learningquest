from fastapi import APIRouter, Depends, HTTPException, Query
from functools import lru_cache
from functools import lru_cache
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, case, cast, Float
from datetime import datetime, timedelta
from typing import List, Optional
from app.database.connection import get_db
from app.models.activity_log import ActivityLog
from app.models.badge import UserBadge
from app.models.quest import QuestProgress, Quest, ExperiencePoints
from app.models.user import User
from app.models.course import Course
from app.auth.dependencies import get_current_user_optional
from app.utils.auth import get_role_required


# Caching helpers for endpoints
def get_engagement_cache_key(time_range, course_id):
    return f"{time_range}:{course_id}"

@lru_cache(maxsize=128)
def cached_engagement_analytics(time_range, course_id):
    return None

def get_summary_cache_key(time_range, course_id):
    return f"{time_range}:{course_id}"

@lru_cache(maxsize=128)
def cached_engagement_summary(time_range, course_id):
    return None

def get_insights_cache_key(time_range, course_id):
    return f"{time_range}:{course_id}"

@lru_cache(maxsize=128)
def cached_engagement_insights(time_range, course_id):
    return None

def get_performance_cache_key(time_range, course_id):
    return f"{time_range}:{course_id}"

@lru_cache(maxsize=128)
def cached_performance_analytics(time_range, course_id):
    return None

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_role_required("teacher"))],
)

@router.get("/engagement")
async def get_engagement_analytics(
    time_range: str = Query("week", description="Time range: week, month, semester"),
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get engagement analytics data including active users, badges earned, and quests completed
    """
    try:
        cache_key = get_engagement_cache_key(time_range, course_id)
        cached_result = cached_engagement_analytics(time_range, course_id)
        if cached_result:
            return cached_result
        # Calculate date range
        end_date = datetime.now()
        if time_range == "week":
            start_date = end_date - timedelta(days=7)
        elif time_range == "month":
            start_date = end_date - timedelta(days=30)
        elif time_range == "semester":
            start_date = end_date - timedelta(days=90)
        else:
            raise HTTPException(status_code=400, detail="Invalid time range")

        # Base query conditions
        base_conditions = [
            ActivityLog.timestamp >= start_date,
            ActivityLog.timestamp <= end_date
        ]

        # Filter by course if specified
        if course_id:
            base_conditions.append(ActivityLog.related_entity_id == course_id)

        # Get daily active users
        daily_active_users = db.query(
            func.date(ActivityLog.timestamp).label('day'),
            func.count(func.distinct(ActivityLog.user_id)).label('activeUsers')
        ).filter(
            and_(*base_conditions)
        ).group_by(
            func.date(ActivityLog.timestamp)
        ).order_by(
            func.date(ActivityLog.timestamp)
        ).all()

        # Get daily badges earned
        badge_conditions = [
            UserBadge.awarded_at >= start_date,
            UserBadge.awarded_at <= end_date
        ]
        if course_id:
            badge_conditions.append(UserBadge.course_id == course_id)

        daily_badges_earned = db.query(
            func.date(UserBadge.awarded_at).label('day'),
            func.count(UserBadge.user_badge_id).label('badgesEarned')
        ).filter(
            and_(*badge_conditions)
        ).group_by(
            func.date(UserBadge.awarded_at)
        ).order_by(
            func.date(UserBadge.awarded_at)
        ).all()

        # Get daily quests completed
        quest_conditions = [
            QuestProgress.completed_at >= start_date,
            QuestProgress.completed_at <= end_date,
            QuestProgress.status == 'completed'
        ]
        if course_id:
            # Join with quests table to filter by course
            daily_quests_completed = db.query(
                func.date(QuestProgress.completed_at).label('day'),
                func.count(QuestProgress.progress_id).label('questsCompleted')
            ).join(
                Quest, QuestProgress.quest_id == Quest.quest_id
            ).filter(
                and_(*quest_conditions, Quest.course_id == course_id)
            ).group_by(
                func.date(QuestProgress.completed_at)
            ).order_by(
                func.date(QuestProgress.completed_at)
            ).all()
        else:
            daily_quests_completed = db.query(
                func.date(QuestProgress.completed_at).label('day'),
                func.count(QuestProgress.progress_id).label('questsCompleted')
            ).filter(
                and_(*quest_conditions)
            ).group_by(
                func.date(QuestProgress.completed_at)
            ).order_by(
                func.date(QuestProgress.completed_at)
            ).all()

        # Combine all data by day
        engagement_data = {}
        
        # Initialize all days in the range
        current_date = start_date.date()
        while current_date <= end_date.date():
            day_name = current_date.strftime("%A")
            engagement_data[current_date] = {
                "day": day_name,
                "activeUsers": 0,
                "badgesEarned": 0,
                "questsCompleted": 0
            }
            current_date += timedelta(days=1)

        # Fill in actual data
        for record in daily_active_users:
            day_name = record.day.strftime("%A")
            engagement_data[record.day]["activeUsers"] = record.activeUsers

        for record in daily_badges_earned:
            day_name = record.day.strftime("%A")
            engagement_data[record.day]["badgesEarned"] = record.badgesEarned

        for record in daily_quests_completed:
            day_name = record.day.strftime("%A")
            engagement_data[record.day]["questsCompleted"] = record.questsCompleted

        # Convert to list format for frontend
        result = list(engagement_data.values())

        return {
            "success": True,
            "data": result,
            "timeRange": time_range,
            "courseId": course_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching engagement analytics: {str(e)}")

@router.get("/summary")
async def get_engagement_summary(
    time_range: str = Query("week", description="Time range: week, month, semester"),
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for engagement analytics
    """
    try:
        cache_key = get_summary_cache_key(time_range, course_id)
        cached_result = cached_engagement_summary(time_range, course_id)
        if cached_result:
            return cached_result
        # Calculate date range
        end_date = datetime.now()
        if time_range == "week":
            start_date = end_date - timedelta(days=7)
        elif time_range == "month":
            start_date = end_date - timedelta(days=30)
        elif time_range == "semester":
            start_date = end_date - timedelta(days=90)
        else:
            raise HTTPException(status_code=400, detail="Invalid time range")

        # Base conditions
        base_conditions = [
            ActivityLog.timestamp >= start_date,
            ActivityLog.timestamp <= end_date
        ]

        if course_id:
            base_conditions.append(ActivityLog.related_entity_id == course_id)

        # Total active users
        total_active_users = db.query(
            func.count(func.distinct(ActivityLog.user_id))
        ).filter(and_(*base_conditions)).scalar()

        # Total badges earned
        badge_conditions = [
            UserBadge.awarded_at >= start_date,
            UserBadge.awarded_at <= end_date
        ]
        if course_id:
            badge_conditions.append(UserBadge.course_id == course_id)

        total_badges_earned = db.query(
            func.count(UserBadge.user_badge_id)
        ).filter(and_(*badge_conditions)).scalar()

        # Total quests completed
        quest_conditions = [
            QuestProgress.completed_at >= start_date,
            QuestProgress.completed_at <= end_date,
            QuestProgress.status == 'completed'
        ]

        if course_id:
            total_quests_completed = db.query(
                func.count(QuestProgress.progress_id)
            ).join(
                Quest, QuestProgress.quest_id == Quest.quest_id
            ).filter(
                and_(*quest_conditions, Quest.course_id == course_id)
            ).scalar()
        else:
            total_quests_completed = db.query(
                func.count(QuestProgress.progress_id)
            ).filter(and_(*quest_conditions)).scalar()

        return {
            "success": True,
            "data": {
                "totalActiveUsers": total_active_users or 0,
                "totalBadgesEarned": total_badges_earned or 0,
                "totalQuestsCompleted": total_quests_completed or 0,
                "timeRange": time_range,
                "courseId": course_id
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching engagement summary: {str(e)}") 

def get_performance_cache_key(time_range, course_id):
    return f"{time_range}:{course_id}"

@lru_cache(maxsize=128)
def cached_performance_analytics(time_range, course_id):
    # This function is a placeholder for actual caching logic
    # In production, use Redis or another distributed cache
    return None

@router.get("/performance")
async def get_performance_analytics(
    time_range: str = Query("week", description="Time range: week, month, semester"),
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get performance analytics including average XP per day and completion rates per day
    """
    try:
        # Check cache first
        cache_key = get_performance_cache_key(time_range, course_id)
        cached_result = cached_performance_analytics(time_range, course_id)
        if cached_result:
            return cached_result
        # Calculate date range
        end_date = datetime.now()
        if time_range == "week":
            start_date = end_date - timedelta(days=7)
        elif time_range == "month":
            start_date = end_date - timedelta(days=30)
        elif time_range == "semester":
            start_date = end_date - timedelta(days=90)
        else:
            raise HTTPException(status_code=400, detail="Invalid time range")

        # Base query for quest performance by day
        base_conditions = [
            QuestProgress.completed_at >= start_date,
            QuestProgress.completed_at <= end_date
        ]

        # Filter by course if specified
        if course_id:
            base_conditions.append(Quest.course_id == course_id)

        # Get daily performance data
        performance_data = db.query(
            func.date(QuestProgress.completed_at).label('day'),
            func.avg(Quest.exp_reward).label('averageXp'),
            func.count(QuestProgress.progress_id).label('totalAttempts'),
            func.sum(case((QuestProgress.status == 'completed', 1), else_=0)).label('completedQuests'),
            cast(
                func.sum(case((QuestProgress.status == 'completed', 1), else_=0)) * 100.0 / 
                func.count(QuestProgress.progress_id), 
                Float
            ).label('completionRate')
        ).join(
            Quest, QuestProgress.quest_id == Quest.quest_id
        ).filter(
            and_(*base_conditions)
        ).group_by(
            func.date(QuestProgress.completed_at)
        ).order_by(
            func.date(QuestProgress.completed_at)
        ).all()

        # Create a complete date range and fill in missing days
        daily_data = {}
        current_date = start_date.date()
        while current_date <= end_date.date():
            day_name = current_date.strftime("%A")
            daily_data[current_date] = {
                "day": day_name,
                "averageXp": 0,
                "completionRate": 0,
                "totalAttempts": 0,
                "completedQuests": 0
            }
            current_date += timedelta(days=1)

        for record in performance_data:
            day_name = record.day.strftime("%A")
            daily_data[record.day] = {
                "day": day_name,
                "averageXp": float(record.averageXp) if record.averageXp else 0,
                "completionRate": float(record.completionRate) if record.completionRate else 0,
                "totalAttempts": record.totalAttempts,
                "completedQuests": record.completedQuests
            }

        # Convert to list format for frontend
        result = list(daily_data.values())

        response = {
            "success": True,
            "data": result,
            "timeRange": time_range,
            "courseId": course_id
        }
        # Store in cache (for demo, lru_cache is read-only, so this is a placeholder)
        # In production, use Redis or another cache to store response
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching performance analytics: {str(e)}") 

@router.get("/engagement-insights")
async def get_engagement_insights(
    time_range: str = Query("week", description="Time range: week, month, semester"),
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Get detailed engagement insights including login patterns, activity heatmaps, 
    engagement intensity, and streak analysis
    """
    try:
        cache_key = get_insights_cache_key(time_range, course_id)
        cached_result = cached_engagement_insights(time_range, course_id)
        if cached_result:
            return cached_result
        # Calculate date range
        end_date = datetime.now()
        if time_range == "week":
            start_date = end_date - timedelta(days=7)
        elif time_range == "month":
            start_date = end_date - timedelta(days=30)
        elif time_range == "semester":
            start_date = end_date - timedelta(days=90)
        else:
            raise HTTPException(status_code=400, detail="Invalid time range")

        # Base conditions
        base_conditions = [
            ActivityLog.timestamp >= start_date,
            ActivityLog.timestamp <= end_date
        ]

        if course_id:
            base_conditions.append(ActivityLog.related_entity_id == course_id)

        # 1. Login Patterns (by hour of day)
        login_patterns = db.query(
            extract('hour', ActivityLog.timestamp).label('hour'),
            func.count(func.distinct(ActivityLog.user_id)).label('uniqueUsers')
        ).filter(
            and_(*base_conditions, ActivityLog.action_type == 'login')
        ).group_by(
            extract('hour', ActivityLog.timestamp)
        ).order_by(
            extract('hour', ActivityLog.timestamp)
        ).all()

        # 2. Activity Heatmap (by day of week and hour)
        activity_heatmap = db.query(
            extract('dow', ActivityLog.timestamp).label('dayOfWeek'),
            extract('hour', ActivityLog.timestamp).label('hour'),
            func.count(ActivityLog.log_id).label('activityCount')
        ).filter(
            and_(*base_conditions)
        ).group_by(
            extract('dow', ActivityLog.timestamp),
            extract('hour', ActivityLog.timestamp)
        ).all()

        # 3. Engagement Intensity (users categorized by activity level)
        user_activity_counts = db.query(
            ActivityLog.user_id,
            func.count(ActivityLog.log_id).label('activityCount')
        ).filter(
            and_(*base_conditions)
        ).group_by(
            ActivityLog.user_id
        ).all()

        # Categorize users by engagement level
        engagement_levels = {
            'high': 0,    # >10 activities per day on average
            'medium': 0,  # 3-10 activities per day on average
            'low': 0      # <3 activities per day on average
        }

        days_in_range = (end_date - start_date).days + 1
        for user_activity in user_activity_counts:
            avg_daily_activity = user_activity.activityCount / days_in_range
            if avg_daily_activity > 10:
                engagement_levels['high'] += 1
            elif avg_daily_activity >= 3:
                engagement_levels['medium'] += 1
            else:
                engagement_levels['low'] += 1

        # 4. Streak Analysis (consecutive days of activity)
        daily_user_activity = db.query(
            func.date(ActivityLog.timestamp).label('date'),
            func.count(func.distinct(ActivityLog.user_id)).label('activeUsers')
        ).filter(
            and_(*base_conditions)
        ).group_by(
            func.date(ActivityLog.timestamp)
        ).order_by(
            func.date(ActivityLog.timestamp)
        ).all()

        # Optimized: Calculate active_days directly from the database
        active_days = db.query(
            func.count()
        ).select_from(
            db.query(
                func.date(ActivityLog.timestamp).label('date')
            )
            .filter(and_(*base_conditions))
            .group_by(func.date(ActivityLog.timestamp))
            .having(func.count(func.distinct(ActivityLog.user_id)) > 0)
            .subquery()
        ).scalar()

        # Calculate streak metrics
        streak_data = []
        current_streak = 0
        max_streak = 0
        total_days = len(daily_user_activity)
        # active_days is now calculated above

        for i, day in enumerate(daily_user_activity):
            if day.activeUsers > 0:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0

        # 5. Most Active Time Periods - Simplified approach
        time_periods_data = []
        
        # Early Morning (12AM-6AM)
        early_morning_count = db.query(func.count(ActivityLog.log_id)).filter(
            and_(*base_conditions, extract('hour', ActivityLog.timestamp) < 6)
        ).scalar()
        time_periods_data.append({
            'period': 'Early Morning (12AM-6AM)',
            'activityCount': early_morning_count or 0
        })
        
        # Morning (6AM-12PM)
        morning_count = db.query(func.count(ActivityLog.log_id)).filter(
            and_(*base_conditions, 
                  extract('hour', ActivityLog.timestamp) >= 6,
                  extract('hour', ActivityLog.timestamp) < 12)
        ).scalar()
        time_periods_data.append({
            'period': 'Morning (6AM-12PM)',
            'activityCount': morning_count or 0
        })
        
        # Afternoon (12PM-6PM)
        afternoon_count = db.query(func.count(ActivityLog.log_id)).filter(
            and_(*base_conditions,
                  extract('hour', ActivityLog.timestamp) >= 12,
                  extract('hour', ActivityLog.timestamp) < 18)
        ).scalar()
        time_periods_data.append({
            'period': 'Afternoon (12PM-6PM)',
            'activityCount': afternoon_count or 0
        })
        
        # Evening (6PM-12AM)
        evening_count = db.query(func.count(ActivityLog.log_id)).filter(
            and_(*base_conditions, extract('hour', ActivityLog.timestamp) >= 18)
        ).scalar()
        time_periods_data.append({
            'period': 'Evening (6PM-12AM)',
            'activityCount': evening_count or 0
        })
        
        # Sort by activity count descending
        time_periods = sorted(time_periods_data, key=lambda x: x['activityCount'], reverse=True)

        # 6. Action Type Distribution
        action_distribution = db.query(
            ActivityLog.action_type,
            func.count(ActivityLog.log_id).label('count')
        ).filter(
            and_(*base_conditions)
        ).group_by(
            ActivityLog.action_type
        ).order_by(
            func.count(ActivityLog.log_id).desc()
        ).all()

        # Format login patterns for frontend
        login_patterns_formatted = []
        for hour in range(24):
            hour_data = next((item for item in login_patterns if item.hour == hour), None)
            login_patterns_formatted.append({
                'hour': hour,
                'uniqueUsers': hour_data.uniqueUsers if hour_data else 0
            })

        # Format activity heatmap for frontend
        heatmap_data = {}
        for item in activity_heatmap:
            # Convert decimal to int for array indexing
            day_index = int(item.dayOfWeek)
            day_name = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day_index]
            if day_name not in heatmap_data:
                heatmap_data[day_name] = {}
            heatmap_data[day_name][item.hour] = item.activityCount

        # Format time periods for frontend (already in correct format)
        time_periods_formatted = time_periods

        # Format action distribution for frontend
        action_distribution_formatted = [
            {
                'action': item.action_type,
                'count': item.count
            }
            for item in action_distribution
        ]

        return {
            "success": True,
            "data": {
                "loginPatterns": login_patterns_formatted,
                "activityHeatmap": heatmap_data,
                "engagementLevels": engagement_levels,
                "streakAnalysis": {
                    "currentStreak": current_streak,
                    "maxStreak": max_streak,
                    "totalDays": total_days,
                    "activeDays": active_days,
                    "consistencyRate": (active_days / total_days * 100) if total_days > 0 else 0
                },
                "timePeriods": time_periods_formatted,
                "actionDistribution": action_distribution_formatted
            },
            "timeRange": time_range,
            "courseId": course_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching engagement insights: {str(e)}") 