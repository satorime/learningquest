from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import datetime
from ..database.connection import get_db
from ..models.user import User
from ..models.badge import Badge, UserBadge
from ..models.quest import QuestProgress, StudentProgress
from ..models.course import Course
from ..models.enrollment import CourseEnrollment
from ..services.badge_service import BadgeService
from ..services.activity_log_service import log_activity
from ..schemas.badge_schemas import (
    BadgeCreate,
    Badge as BadgeSchema,
    CustomBadgeCreate,
    CustomBadgeUpdate,
    AwardBadgeRequest,
    AckBadgesRequest,
)
from ..utils.auth import get_current_active_user, require_admin, get_role_required

# Every badge endpoint requires authentication; destructive/award/test endpoints
# below additionally require admin (require_admin).
router = APIRouter(
    prefix="/badges",
    tags=["badges"],
    dependencies=[Depends(get_current_active_user)],
)


@router.post("/retroactive-award")
async def retroactive_badge_award(
    dry_run: bool = True,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Retroactively award badges to users who earned them before the badge system was implemented
    
    Query Parameters:
    - dry_run: If true, only shows what would be awarded (default: true)
    - user_id: If provided, only check this specific user (optional)
    
    Example Postman requests:
    POST /badges/retroactive-award?dry_run=true                    # Preview all users
    POST /badges/retroactive-award?dry_run=false                   # Award to all users  
    POST /badges/retroactive-award?dry_run=true&user_id=16         # Preview specific user
    POST /badges/retroactive-award?dry_run=false&user_id=16        # Award to specific user
    """
    try:
        # Get users to check
        if user_id:
            users = db.query(User).filter(User.id == user_id).all()
            if not users:
                raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        else:
            users = db.query(User).filter(User.is_active == True).all()
        
        # Get all active badges
        badges = db.query(Badge).filter(Badge.is_active == True).all()
        
        total_awarded = 0
        user_results = []
        
        for user in users:
            # Get user's current badges
            current_badges = db.query(UserBadge).filter(UserBadge.user_id == user.id).all()
            current_badge_ids = {ub.badge_id for ub in current_badges}
            
            user_new_badges = []
            
            for badge in badges:
                if badge.badge_id in current_badge_ids:
                    continue  # User already has this badge
                
                # Check if user qualifies for this badge
                if _check_retroactive_qualification(user, badge, db):
                    user_new_badges.append({
                        "badge_id": badge.badge_id,
                        "badge_name": badge.name,
                        "badge_description": badge.description
                    })
                    
                    if not dry_run:
                        # Actually award the badge
                        user_badge = UserBadge(
                            user_id=user.id,
                            badge_id=badge.badge_id,
                            awarded_at=datetime.utcnow(),
                            awarded_by=None,  # System awarded
                            course_id=None
                        )
                        db.add(user_badge)
                        total_awarded += 1
                        # Log activity
                        log_activity(
                            db=db,
                            user_id=user.id,
                            action_type="badge_awarded",
                            action_details={
                                "badge_id": badge.badge_id,
                                "badge_name": badge.name,
                                "retroactive": True
                            },
                            related_entity_type="badge",
                            related_entity_id=badge.badge_id,
                            exp_change=0
                        )
            
            if user_new_badges:
                user_results.append({
                    "user_id": user.id,
                    "moodle_user_id": user.moodle_user_id,
                    "current_badges_count": len(current_badge_ids),
                    "new_badges": user_new_badges,
                    "new_badges_count": len(user_new_badges)
                })
        
        if not dry_run:
            db.commit()
        
        return {
            "success": True,
            "dry_run": dry_run,
            "summary": {
                "total_users_checked": len(users),
                "users_with_new_badges": len(user_results),
                "total_badges_awarded": total_awarded,
                "target_user_id": user_id
            },
            "user_results": user_results,
            "message": f"{'Preview complete' if dry_run else 'Badges awarded successfully'}: {total_awarded} badges {'would be awarded to' if dry_run else 'awarded to'} {len(user_results)} users"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retroactive badge award failed: {str(e)}"
        )


def _check_retroactive_qualification(user: User, badge: Badge, db: Session) -> bool:
    """Check if user qualifies for a badge retroactively"""
    criteria = badge.criteria
    criterion_type = criteria.get("type")
    
    if criterion_type == "quest_completion":
        target = criteria.get("target", 1)        # Count completed quests
        completed_quests = db.query(QuestProgress).filter(
            QuestProgress.user_id == user.id,  # Use local user ID, not moodle_user_id
            QuestProgress.status == "completed"
        ).count()
        
        return completed_quests >= target
        
    elif criterion_type == "total_exp":
        target = criteria.get("target", 1000)
        
        # Get user's total XP - StudentProgress uses user_id (local ID)
        student_progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == user.id  # Use local user ID, not moodle_user_id
        ).first()
        
        if student_progress:
            return student_progress.total_exp >= target
        return False
    
    # Add more criteria types as needed
    return False


@router.post("/", response_model=BadgeSchema)
async def create_badge(
    badge_data: BadgeCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Create a new custom badge"""
    try:
        # Create the badge
        new_badge = Badge(
            name=badge_data.name,
            description=badge_data.description,
            badge_type=badge_data.badge_type,
            image_url=badge_data.image_url or "/badges/default-badge.png",
            criteria=badge_data.criteria,
            exp_value=badge_data.exp_value,
            is_active=badge_data.is_active,
            # created_by=current_user.id  # TODO: Enable when auth is ready
        )
        
        db.add(new_badge)
        db.commit()
        db.refresh(new_badge)
        
        return new_badge
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create badge: {str(e)}"
        )


@router.get("/")
def get_all_badges(
    active_only: bool = Query(True, description="Show only active badges"),
    db: Session = Depends(get_db)
):
    """Get all badges"""
    query = db.query(Badge)
    if active_only:
        query = query.filter(Badge.is_active == True)
    
    badges = query.all()
    return [
        {
            "badge_id": badge.badge_id,
            "name": badge.name,
            "description": badge.description,
            "badge_type": badge.badge_type,
            "image_url": badge.image_url,
            "criteria": badge.criteria,
            "exp_value": badge.exp_value,
            "created_at": badge.created_at.isoformat(),
            "created_by": badge.created_by,
            "is_active": badge.is_active
        }
        for badge in badges
    ]


# NOTE: declared before the "/{badge_id}" route below so "unseen" isn't parsed
# as a badge id.
@router.get("/unseen")
def get_unseen_badges(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Badges the current student has earned but not yet seen the popup for.

    Lets awards that happened while they were offline pop on their next visit.
    """
    rows = (
        db.query(UserBadge, Badge)
        .join(Badge, Badge.badge_id == UserBadge.badge_id)
        .filter(
            UserBadge.user_id == current_user.id,
            UserBadge.popup_seen == False,  # noqa: E712
        )
        .order_by(UserBadge.awarded_at.asc())
        .all()
    )
    out = []
    for _ub, b in rows:
        criteria = b.criteria or {}
        out.append({
            "badge_id": b.badge_id,
            "name": b.name,
            "description": b.description or "",
            "icon": criteria.get("icon", "award"),
            "color": criteria.get("color", "amber"),
            "shape": criteria.get("shape", "circle"),
            "exp_value": b.exp_value or 0,
            "is_custom": b.badge_type == "custom",
        })
    return {"success": True, "badges": out}


@router.post("/unseen/ack")
def ack_unseen_badges(
    data: AckBadgesRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Mark the given badges' popups as seen for the current student."""
    if not data.badge_ids:
        return {"success": True, "updated": 0}
    updated = db.query(UserBadge).filter(
        UserBadge.user_id == current_user.id,
        UserBadge.badge_id.in_(data.badge_ids),
    ).update({UserBadge.popup_seen: True}, synchronize_session=False)
    db.commit()
    return {"success": True, "updated": updated}


@router.get("/{badge_id}")
async def get_badge(
    badge_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific badge by ID"""
    badge = db.query(Badge).filter(Badge.badge_id == badge_id).first()
    if not badge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Badge not found"
        )
    return {
        "badge_id": badge.badge_id,
        "name": badge.name,
        "description": badge.description,
        "badge_type": badge.badge_type,
        "image_url": badge.image_url,
        "criteria": badge.criteria,
        "exp_value": badge.exp_value,
        "created_at": badge.created_at.isoformat(),
        "created_by": badge.created_by,
        "is_active": badge.is_active
    }


@router.get("/user/{user_id}/progress")
def get_user_badge_progress(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get user's badge progress (earned and available badges)"""
    try:
        badge_service = BadgeService(db)
        badges_with_progress = badge_service.get_user_badges_with_progress(user_id)
        
        # Separate earned and available badges
        earned = [b for b in badges_with_progress if b["earned"]]
        available = [b for b in badges_with_progress if not b["earned"]]
        
        return {
            "earned_badges": earned,
            "available_badges": available,
            "stats": {
                "total_badges": len(badges_with_progress),
                "earned_count": len(earned),
                "available_count": len(available),
                "completion_percentage": (len(earned) / len(badges_with_progress) * 100) if badges_with_progress else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/earned")
async def get_user_earned_badges(
    user_id: int,
    course_id: Optional[int] = Query(None, description="Filter by course"),
    db: Session = Depends(get_db)
):
    """Get user's earned badges"""
    query = db.query(UserBadge).filter(UserBadge.user_id == user_id)
    
    if course_id:
        query = query.filter(UserBadge.course_id == course_id)
    
    user_badges = query.all()
    return [
        {
            "user_badge_id": ub.user_badge_id,
            "user_id": ub.user_id,
            "badge_id": ub.badge_id,
            "awarded_at": ub.awarded_at.isoformat(),
            "awarded_by": ub.awarded_by,
            "course_id": ub.course_id,
            "badge": {
                "badge_id": ub.badge.badge_id,
                "name": ub.badge.name,
                "description": ub.badge.description,
                "badge_type": ub.badge.badge_type,
                "image_url": ub.badge.image_url,
                "criteria": ub.badge.criteria,
                "exp_value": ub.badge.exp_value,
                "is_active": ub.badge.is_active
            } if ub.badge else None
        }
        for ub in user_badges
    ]


@router.post("/check/{user_id}")
async def check_and_award_badges(
    user_id: int,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Check and automatically award badges to a user"""
    try:
        badge_service = BadgeService(db)
        newly_awarded = badge_service.check_and_award_badges(user_id, course_id)
        
        return {
            "message": f"Checked badges for user {user_id}",
            "newly_awarded": len(newly_awarded),
            "badges": [
                {
                    "name": award["badge"].name,
                    "exp_bonus": award["exp_bonus"]
                }
                for award in newly_awarded
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed")
async def seed_badges_endpoint(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Seed predefined badges (admin only)"""
    try:
        from ..seeders.badge_seeder import seed_badges
        seed_badges(db)
        return {"message": "Badges seeded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")


@router.post("/award")
async def manually_award_badge(
    user_id: int,
    badge_id: int,
    awarded_by: int = 1,  # Default to user 1 for now
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Manually award a badge to a user (admin function)"""
    try:
        badge_service = BadgeService(db)
        result = badge_service.manually_award_badge(user_id, badge_id, awarded_by, course_id)
        return {
            "message": f"Badge successfully awarded to user {user_id}",
            "badge": {
                "name": result["badge"].name,
                "exp_value": result["badge"].exp_value
            },
            "exp_bonus": result["exp_bonus"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Teacher custom badges --------------------------------------------------
# Teachers design their own badges (rendered as in-app SVG medallions) and hand
# them to students in their classes. These never auto-award (criteria "manual").

def _badge_to_dict(badge: Badge) -> dict:
    return {
        "badge_id": badge.badge_id,
        "name": badge.name,
        "description": badge.description,
        "badge_type": badge.badge_type,
        "image_url": badge.image_url,
        "criteria": badge.criteria,
        "exp_value": badge.exp_value,
        "created_by": badge.created_by,
        "is_active": badge.is_active,
    }


def _teaches_student(db: Session, teacher_id: int, student_id: int) -> Optional[int]:
    """Return a course_id where `student` is actively enrolled under `teacher`, else None."""
    row = (
        db.query(CourseEnrollment.course_id)
        .join(Course, Course.id == CourseEnrollment.course_id)
        .filter(
            Course.teacher_id == teacher_id,
            CourseEnrollment.user_id == student_id,
            CourseEnrollment.status == "active",
        )
        .first()
    )
    return row[0] if row else None


@router.post("/custom")
async def create_custom_badge(
    data: CustomBadgeCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    """Create a teacher-owned custom badge (manual award only)."""
    if data.shape not in ("circle", "shield", "banner"):
        raise HTTPException(status_code=400, detail="Invalid shape")
    badge = Badge(
        name=data.name.strip(),
        description=(data.description or "").strip() or None,
        badge_type="custom",
        criteria={
            "type": "manual",
            "icon": data.icon,
            "color": data.color,
            "shape": data.shape,
            "description": (data.description or "").strip(),
        },
        exp_value=max(0, data.exp_value),
        created_by=teacher.id,
        is_active=True,
    )
    db.add(badge)
    db.commit()
    db.refresh(badge)
    return {"success": True, "badge": _badge_to_dict(badge)}


@router.get("/custom/mine")
async def list_my_custom_badges(
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    """Custom badges created by the current teacher."""
    badges = (
        db.query(Badge)
        .filter(Badge.created_by == teacher.id, Badge.badge_type == "custom")
        .order_by(Badge.created_at.desc())
        .all()
    )
    return {"success": True, "badges": [_badge_to_dict(b) for b in badges]}


def _owned_custom_badge(db: Session, badge_id: int, teacher: User) -> Badge:
    badge = db.query(Badge).filter(Badge.badge_id == badge_id).first()
    if not badge or badge.badge_type != "custom":
        raise HTTPException(status_code=404, detail="Custom badge not found")
    if badge.created_by != teacher.id and teacher.role != "admin":
        raise HTTPException(status_code=403, detail="Not your badge")
    return badge


@router.put("/custom/{badge_id}")
async def update_custom_badge(
    badge_id: int,
    data: CustomBadgeUpdate,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    badge = _owned_custom_badge(db, badge_id, teacher)
    criteria = dict(badge.criteria or {})
    if data.name is not None:
        badge.name = data.name.strip()
    if data.description is not None:
        badge.description = data.description.strip() or None
        criteria["description"] = data.description.strip()
    if data.icon is not None:
        criteria["icon"] = data.icon
    if data.color is not None:
        criteria["color"] = data.color
    if data.shape is not None:
        if data.shape not in ("circle", "shield", "banner"):
            raise HTTPException(status_code=400, detail="Invalid shape")
        criteria["shape"] = data.shape
    if data.exp_value is not None:
        badge.exp_value = max(0, data.exp_value)
    if data.is_active is not None:
        badge.is_active = data.is_active
    badge.criteria = criteria
    db.commit()
    db.refresh(badge)
    return {"success": True, "badge": _badge_to_dict(badge)}


@router.delete("/custom/{badge_id}")
async def delete_custom_badge(
    badge_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    """Soft-deactivate a custom badge (keeps already-awarded copies intact)."""
    badge = _owned_custom_badge(db, badge_id, teacher)
    badge.is_active = False
    db.commit()
    return {"success": True}


@router.post("/custom/{badge_id}/award")
async def award_custom_badge(
    badge_id: int,
    data: AwardBadgeRequest,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    """Award a custom badge to a student the teacher actually teaches."""
    badge = _owned_custom_badge(db, badge_id, teacher)
    course_id = _teaches_student(db, teacher.id, data.user_id)
    if course_id is None and teacher.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="You can only award badges to students enrolled in your classes.",
        )
    try:
        result = BadgeService(db).manually_award_badge(
            data.user_id, badge_id, teacher.id, data.course_id or course_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "success": True,
        "message": f"Awarded '{badge.name}'",
        "exp_bonus": result["exp_bonus"],
    }


@router.delete("/custom/{badge_id}/award/{user_id}")
async def revoke_custom_badge(
    badge_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    badge = _owned_custom_badge(db, badge_id, teacher)
    ub = db.query(UserBadge).filter(
        UserBadge.badge_id == badge_id, UserBadge.user_id == user_id
    ).first()
    if not ub:
        raise HTTPException(status_code=404, detail="That student doesn't have this badge")
    db.delete(ub)
    db.commit()
    # Take back the XP this badge granted the student.
    BadgeService(db).revoke_badge_xp(user_id, badge)
    return {"success": True}


@router.get("/custom/{badge_id}/recipients")
async def custom_badge_recipients(
    badge_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(get_role_required("teacher")),
):
    _owned_custom_badge(db, badge_id, teacher)
    rows = (
        db.query(UserBadge, User)
        .join(User, User.id == UserBadge.user_id)
        .filter(UserBadge.badge_id == badge_id)
        .order_by(UserBadge.awarded_at.desc())
        .all()
    )
    return {
        "success": True,
        "recipients": [
            {
                "user_id": u.id,
                "name": f"{u.first_name} {u.last_name}".strip() or u.username,
                "awarded_at": ub.awarded_at.isoformat() if ub.awarded_at else None,
            }
            for ub, u in rows
        ],
    }


@router.get("/user/{user_id}")
def get_user_badges_simple(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get user's earned badges (simple endpoint for backwards compatibility)"""
    query = db.query(UserBadge).filter(UserBadge.user_id == user_id)
    user_badges = query.all()
    return [
        {
            "user_badge_id": ub.user_badge_id,
            "user_id": ub.user_id,
            "badge_id": ub.badge_id,
            "awarded_at": ub.awarded_at.isoformat(),
            "awarded_by": ub.awarded_by,
            "course_id": ub.course_id,
            "badge": {
                "badge_id": ub.badge.badge_id,
                "name": ub.badge.name,
                "description": ub.badge.description,
                "badge_type": ub.badge.badge_type,
                "image_url": ub.badge.image_url,
                "criteria": ub.badge.criteria,
                "exp_value": ub.badge.exp_value,
                "is_active": ub.badge.is_active
            } if ub.badge else None
        }
        for ub in user_badges
    ]


@router.post("/check-all/{user_id}")
async def check_all_badges_for_user(
    user_id: int,
    course_id: Optional[int] = None,
    awarded_by: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Check all badge criteria for a user and award eligible badges"""
    try:
        badge_service = BadgeService(db)
        awarded_badges = badge_service.check_and_award_badges(user_id, course_id, awarded_by)
        
        return {
            "message": f"Badge check completed for user {user_id}",
            "newly_awarded": len(awarded_badges),
            "badges": [
                {
                    "name": result["badge"].name,
                    "exp_bonus": result["exp_bonus"]
                }
                for result in awarded_badges
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check badges: {str(e)}"
        )


@router.post("/trigger-check")
async def trigger_badge_check(
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Trigger badge checking when specific events occur
    Expected request format:
    {
        "user_id": int,
        "event_type": "quest_completed" | "login" | "xp_earned" | "daily_quest_completed",
        "course_id": int (optional),
        "metadata": {} (optional additional data)
    }
    """
    try:
        user_id = request.get("user_id")
        event_type = request.get("event_type")
        course_id = request.get("course_id")
        
        if not user_id or not event_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id and event_type are required"
            )
        
        badge_service = BadgeService(db)
        awarded_badges = badge_service.check_and_award_badges(user_id, course_id)
        
        return {
            "message": f"Badge check triggered for {event_type} event",
            "user_id": user_id,
            "event_type": event_type,
            "newly_awarded": len(awarded_badges),
            "badges": [
                {
                    "name": result["badge"].name,
                    "exp_bonus": result["exp_bonus"],
                    "badge_id": result["badge"].badge_id
                }
                for result in awarded_badges
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger badge check: {str(e)}"
        )


@router.get("/check-criteria/{user_id}/{badge_id}")
async def check_specific_badge_criteria(
    user_id: int,
    badge_id: int,
    db: Session = Depends(get_db)
):
    """Check if a user meets the criteria for a specific badge (without awarding)"""
    try:
        badge_service = BadgeService(db)
        badge = badge_service.get_badge_by_id(badge_id)
        
        if not badge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Badge not found"
            )
        
        meets_criteria = badge_service._check_badge_criteria(user_id, badge)
        progress = badge_service._calculate_progress(user_id, badge)
        
        return {
            "badge_id": badge_id,
            "badge_name": badge.name,
            "user_id": user_id,
            "meets_criteria": meets_criteria,
            "progress": progress,
            "criteria": badge.criteria
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check badge criteria: {str(e)}"
        )


@router.post("/test/add-quest-completion")
async def add_test_quest_completion(
    request: dict,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Add test quest completion data for testing badges
    Expected request format:
    {
        "user_id": 1,
        "quest_id": 1,
        "status": "completed"
    }
    """
    try:
        user_id = request.get("user_id", 1)
        quest_id = request.get("quest_id", 1)
        status = request.get("status", "completed")
        
        # Check if quest progress already exists
        existing = db.query(QuestProgress).filter(
            and_(
                QuestProgress.user_id == user_id,
                QuestProgress.quest_id == quest_id
            )
        ).first()
        
        if existing:
            existing.status = status
            existing.progress_percent = 100 if status == "completed" else 50
            if status == "completed":
                existing.completed_at = func.now()
        else:
            quest_progress = QuestProgress(
                user_id=user_id,
                quest_id=quest_id,
                status=status,
                progress_percent=100 if status == "completed" else 50,
                started_at=func.now(),
                completed_at=func.now() if status == "completed" else None
            )
            db.add(quest_progress)
        
        db.commit()
        
        return {
            "message": f"Test quest completion added for user {user_id}",
            "user_id": user_id,
            "quest_id": quest_id,
            "status": status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add test data: {str(e)}"
        )


@router.post("/test/add-xp")
async def add_test_xp(
    request: dict,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Add test XP data for testing XP-based badges
    Expected request format:
    {
        "user_id": 1,
        "total_exp": 1000
    }
    """
    try:
        user_id = request.get("user_id", 1)
        total_exp = request.get("total_exp", 1000)
        
        # Check if student progress exists
        existing = db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).first()
        
        if existing:
            existing.total_exp = total_exp
        else:
            student_progress = StudentProgress(
                user_id=user_id,
                total_exp=total_exp,
                quests_completed=1,
                badges_earned=0
            )
            db.add(student_progress)
        
        db.commit()
        
        return {
            "message": f"Test XP data added for user {user_id}",
            "user_id": user_id,
            "total_exp": total_exp
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add test XP data: {str(e)}"
        )

@router.post("/debug/check-user/{user_id}")
async def debug_badge_check(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Debug endpoint to manually check badges for a user and see detailed information
    """
    try:
        # Check if user exists
        user = db.query(User).filter(User.moodle_user_id == user_id).first()
        if not user:
            # Provide helpful debug info when user not found
            all_users = db.query(User).all()
            return {
                "error": "User not found",
                "user_id_searched": user_id,
                "debug_info": {
                    "total_users_in_system": len(all_users),
                    "existing_moodle_user_ids": [u.moodle_user_id for u in all_users],
                    "suggestion": "Check if the user has been created in your system and verify the Moodle user ID"
                }
            }
        
        local_user_id = user.id
        
        badge_service = BadgeService(db)
        
        # Get all badges
        all_badges = badge_service.get_all_badges()
        
        # Get user's quest progress
        quest_progress = db.query(QuestProgress).filter(
            QuestProgress.user_id == local_user_id,
            QuestProgress.status == "completed"
        ).all()
        
        # Get user's student progress
        student_progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == local_user_id
        ).first()
          # Get user's existing badges
        existing_badges = badge_service.get_user_badges(local_user_id)
        
        # Check for new badges
        awarded_badges = badge_service.check_and_award_badges(local_user_id)
        
        return {
            "user_id": user_id,
            "local_user_id": local_user_id,
            "debug_info": {
                "total_badges_in_system": len(all_badges),
                "completed_quests": len(quest_progress),
                "quest_details": [
                    {
                        "quest_id": qp.quest_id,
                        "status": qp.status,
                        "completed_at": qp.completed_at.isoformat() if qp.completed_at else None
                    }
                    for qp in quest_progress
                ],
                "student_progress": {
                    "total_exp": student_progress.total_exp if student_progress else 0,
                    "quests_completed": student_progress.quests_completed if student_progress else 0
                } if student_progress else None,
                "existing_badges": len(existing_badges),
                "existing_badge_details": [
                    {
                        "badge_id": ub.badge_id,
                        "awarded_at": ub.awarded_at.isoformat() if ub.awarded_at else None
                    }
                    for ub in existing_badges
                ]
            },
            "new_badges_awarded": len(awarded_badges),
            "new_badge_details": [
                {
                    "badge_id": badge_award["badge"].badge_id,
                    "name": badge_award["badge"].name,
                    "criteria": badge_award["badge"].criteria,
                    "exp_bonus": badge_award["exp_bonus"]
                }
                for badge_award in awarded_badges
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug check failed: {str(e)}"
        )


@router.post("/debug/check-user-by-local-id/{local_user_id}")
async def debug_badge_check_by_local_id(
    local_user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    Debug endpoint to check badges using the local user ID instead of Moodle user ID
    """
    try:
        # Check if user exists by local ID
        user = db.query(User).filter(User.id == local_user_id).first()
        if not user:
            all_users = db.query(User).all()
            return {
                "error": "User not found by local ID",
                "local_user_id_searched": local_user_id,
                "debug_info": {
                    "total_users_in_system": len(all_users),
                    "existing_local_ids": [u.id for u in all_users],
                    "existing_moodle_user_ids": [u.moodle_user_id for u in all_users],
                    "suggestion": "Check if the local user ID exists in your system"
                }
            }
        
        badge_service = BadgeService(db)
        
        # Get all badges
        all_badges = badge_service.get_all_badges()
        
        # Get user's quest progress
        quest_progress = db.query(QuestProgress).filter(
            QuestProgress.user_id == local_user_id,
            QuestProgress.status == "completed"
        ).all()
        
        # Get user's student progress
        student_progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == local_user_id
        ).first()
          # Get user's existing badges
        existing_badges = badge_service.get_user_badges(local_user_id)
        
        # Check for new badges
        awarded_badges = badge_service.check_and_award_badges(local_user_id)
        
        return {
            "local_user_id": local_user_id,
            "moodle_user_id": user.moodle_user_id,
            "debug_info": {
                "total_badges_in_system": len(all_badges),
                "completed_quests": len(quest_progress),
                "quest_details": [
                    {
                        "quest_id": qp.quest_id,
                        "status": qp.status,
                        "completed_at": qp.completed_at.isoformat() if qp.completed_at else None
                    }
                    for qp in quest_progress
                ],
                "student_progress": {
                    "total_exp": student_progress.total_exp if student_progress else 0,
                    "quests_completed": student_progress.quests_completed if student_progress else 0
                } if student_progress else None,
                "existing_badges": len(existing_badges),
                "existing_badge_details": [
                    {
                        "badge_id": ub.badge_id,
                        "awarded_at": ub.awarded_at.isoformat() if ub.awarded_at else None
                    }
                    for ub in existing_badges
                ]
            },
            "new_badges_awarded": len(awarded_badges),
            "new_badge_details": [
                {
                    "badge_id": badge_award["badge"].badge_id,
                    "name": badge_award["badge"].name,
                    "criteria": badge_award["badge"].criteria,
                    "exp_bonus": badge_award["exp_bonus"]
                }
                for badge_award in awarded_badges
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Debug check failed: {str(e)}"
        )


# Ensure router is properly exported
__all__ = ["router"]
