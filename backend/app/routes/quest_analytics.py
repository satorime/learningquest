"""
Quest Analytics API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.auth.dependencies import get_current_user_optional
from app.models.user import User
from app.services.quest_engagement_service import QuestEngagementService
from app.utils.auth import get_role_required

router = APIRouter(
    tags=["quest-analytics"],
    dependencies=[Depends(get_role_required("teacher"))],
)

@router.get("/quest/{quest_id}")
async def get_quest_analytics(
    quest_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed analytics for a specific quest"""
    try:
        engagement_service = QuestEngagementService(db)
        analytics = engagement_service.get_quest_analytics(quest_id)
        
        if not analytics:
            raise HTTPException(status_code=404, detail="Quest not found")
        
        return {
            "success": True,
            "data": analytics
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quest/{quest_id}/timeseries")
async def get_quest_timeseries(
    quest_id: int,
    days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """Daily active participants and completions for this quest."""
    try:
        from app.models.quest import Quest, QuestProgress, QuestEngagementEvent
        quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found")

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Active participants per day (any event for this quest)
        events = db.query(QuestEngagementEvent).join(
            QuestProgress, QuestEngagementEvent.quest_progress_id == QuestProgress.progress_id
        ).filter(
            QuestProgress.quest_id == quest_id,
            QuestEngagementEvent.timestamp >= datetime.combine(start_date, datetime.min.time())
        ).all()

        active_by_day: Dict[str, set] = {}
        for ev in events:
            d = ev.timestamp.date().isoformat()
            s = active_by_day.setdefault(d, set())
            s.add(ev.quest_progress_id)

        # Completions per day
        qps = db.query(QuestProgress).filter(
            QuestProgress.quest_id == quest_id,
            QuestProgress.completed_at.isnot(None),
            QuestProgress.completed_at >= datetime.combine(start_date, datetime.min.time())
        ).all()
        completed_by_day: Dict[str, int] = {}
        for qp in qps:
            d = qp.completed_at.date().isoformat()
            completed_by_day[d] = completed_by_day.get(d, 0) + 1

        # Build series
        series = []
        for i in range(days):
            d = (start_date + timedelta(days=i)).isoformat()
            series.append({
                "date": d,
                "activeParticipants": len(active_by_day.get(d, set())),
                "completions": completed_by_day.get(d, 0)
            })

        return {"success": True, "data": {"series": series}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quest/{quest_id}/heatmap")
async def get_quest_heatmap(
    quest_id: int,
    db: Session = Depends(get_db)
):
    """Events count by hour (0-23) for this quest."""
    try:
        from app.models.quest import Quest, QuestProgress, QuestEngagementEvent
        quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found")

        events = db.query(QuestEngagementEvent).join(
            QuestProgress, QuestEngagementEvent.quest_progress_id == QuestProgress.progress_id
        ).filter(QuestProgress.quest_id == quest_id).all()

        by_hour = [0] * 24
        for ev in events:
            h = ev.timestamp.hour
            by_hour[h] += 1

        return {"success": True, "data": {"byHour": by_hour}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quest/{quest_id}/tiers")
async def get_quest_tiers(
    quest_id: int,
    db: Session = Depends(get_db)
):
    """High/Medium/Low engagement tier counts for this quest."""
    try:
        from app.models.quest import Quest, QuestProgress
        quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found")

        qps = db.query(QuestProgress).filter(QuestProgress.quest_id == quest_id).all()
        high = sum(1 for qp in qps if (qp.engagement_score or 0) >= 70)
        med = sum(1 for qp in qps if 30 <= (qp.engagement_score or 0) <= 69)
        low = sum(1 for qp in qps if (qp.engagement_score or 0) < 30)
        return {"success": True, "data": {"high": high, "medium": med, "low": low}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/quest/{quest_id}/students")
async def get_quest_student_progress(
    quest_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get individual student progress for a quest"""
    try:
        from app.models.quest import Quest, QuestProgress
        from app.models.user import User
        from app.models.course import Course
        from app.models.enrollment import CourseEnrollment
        
        # Get quest
        quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found")
        
        # Pagination
        offset = (page - 1) * page_size

        # Determine course of the quest
        course = db.query(Course).filter(Course.id == quest.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found for quest")

        # Query all active enrollments for the course, LEFT JOIN progress for this quest
        base = db.query(
            CourseEnrollment,
            User,
            QuestProgress
        ).join(User, CourseEnrollment.user_id == User.id).outerjoin(
            QuestProgress,
            (QuestProgress.user_id == CourseEnrollment.user_id) & (QuestProgress.quest_id == quest_id)
        ).filter(
            CourseEnrollment.course_id == course.id,
            CourseEnrollment.status == 'active'
        )

        total = base.count()

        rows = base.order_by(User.id.asc()).offset(offset).limit(page_size).all()

        students = []
        for enr, user, qp in rows:
            students.append({
                "user_id": user.id,
                "name": f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip() or user.email,
                "email": user.email,
                "engagement_stage": getattr(qp, 'engagement_stage', None) or 'not_started',
                "engagement_score": getattr(qp, 'engagement_score', None) or 0,
                "interaction_count": getattr(qp, 'interaction_count', None) or 0,
                "progress_percent": getattr(qp, 'progress_percent', None) or 0,
                "started_at": qp.started_at.isoformat() if qp and qp.started_at else None,
                "completed_at": qp.completed_at.isoformat() if qp and qp.completed_at else None,
                "validated_at": qp.validated_at.isoformat() if qp and qp.validated_at else None,
                "first_interaction_at": qp.first_interaction_at.isoformat() if qp and qp.first_interaction_at else None,
                "last_interaction_at": qp.last_interaction_at.isoformat() if qp and qp.last_interaction_at else None
            })
        
        return {
            "success": True,
            "data": {
                "quest_id": quest_id,
                "quest_title": quest.title,
                "students": students,
                "page": page,
                "page_size": page_size,
                "total": total
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quest/{quest_id}/events")
async def get_quest_engagement_events(
    quest_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Get recent engagement events for a quest"""
    try:
        from app.models.quest import Quest, QuestProgress, QuestEngagementEvent
        from app.models.user import User
        
        # Get quest
        quest = db.query(Quest).filter(Quest.quest_id == quest_id).first()
        if not quest:
            raise HTTPException(status_code=404, detail="Quest not found")
        
        # Get recent events
        events = db.query(
            QuestEngagementEvent,
            User.first_name,
            User.last_name
        ).join(
            QuestProgress, QuestEngagementEvent.quest_progress_id == QuestProgress.progress_id
        ).join(
            User, QuestProgress.user_id == User.id
        ).filter(
            QuestProgress.quest_id == quest_id
        ).order_by(
            QuestEngagementEvent.timestamp.desc()
        ).limit(limit).all()
        
        event_list = []
        for event, first_name, last_name in events:
            event_list.append({
                "id": event.id,
                "user_name": f"{first_name} {last_name}",
                "event_type": event.event_type,
                "engagement_points": event.engagement_points,
                "timestamp": event.timestamp.isoformat(),
                "event_data": event.event_data
            })
        
        return {
            "success": True,
            "data": {
                "quest_id": quest_id,
                "events": event_list
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
