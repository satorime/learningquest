"""Native class (group) management and enrollment.

A "class" is a `Course` owned by a teacher. Students join via a unique join
code (stored in `Course.enrollment_key`). Membership lives in
`CourseEnrollment`. Replaces the Moodle course-sync flow.
"""
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.quest import Quest
from app.models.quiz import QuestSubmission
from app.schemas.classroom import (
    ClassCreate,
    ClassUpdate,
    ClassResponse,
    JoinClassRequest,
    MemberResponse,
)
from app.utils.auth import get_current_active_user, require_teacher


class LeaderboardEntry(BaseModel):
    """A single leaderboard row — name only, no score is ever exposed."""
    rank: int
    name: str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/classes", tags=["classes"])

# Unambiguous alphabet (no O/0, I/1) for human-friendly join codes.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_join_code(db: Session, length: int = 6) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))
        if not db.query(Course).filter(Course.enrollment_key == code).first():
            return code
    # Extremely unlikely; widen the space.
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length + 2))


def _member_count(db: Session, course_id: int) -> int:
    return db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.role == "student",
        CourseEnrollment.status == "active",
    ).count()


def _to_response(db: Session, course: Course) -> ClassResponse:
    return ClassResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        join_code=course.enrollment_key,
        teacher_id=course.teacher_id,
        is_active=bool(course.is_active),
        start_date=course.start_date,
        end_date=course.end_date,
        created_at=course.created_at,
        member_count=_member_count(db, course.id),
    )


def _get_owned_class(db: Session, class_id: int, user: User) -> Course:
    """Fetch a class the user may manage (its teacher, or any admin)."""
    course = db.query(Course).filter(Course.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found")
    if user.role != "admin" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your class")
    return course


# --- teacher: manage classes ------------------------------------------------
@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    data: ClassCreate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    course = Course(
        title=data.title,
        description=data.description,
        teacher_id=teacher.id,
        is_active=True,
        start_date=data.start_date,
        end_date=data.end_date,
        enrollment_key=_generate_join_code(db),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _to_response(db, course)


@router.get("", response_model=list[ClassResponse])
async def list_my_classes(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    """Classes taught by the current teacher (all classes for admins)."""
    query = db.query(Course)
    if teacher.role != "admin":
        query = query.filter(Course.teacher_id == teacher.id)
    if not include_archived:
        query = query.filter(Course.is_active == True)
    return [_to_response(db, c) for c in query.order_by(Course.created_at.desc()).all()]


@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    course = db.query(Course).filter(Course.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found")
    # Teacher/admin always; students only if enrolled.
    if user.role == "student":
        enrolled = db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id == class_id,
            CourseEnrollment.user_id == user.id,
            CourseEnrollment.status == "active",
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this class")
    elif user.role == "teacher" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your class")
    return _to_response(db, course)


@router.patch("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: int,
    data: ClassUpdate,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    course = _get_owned_class(db, class_id, teacher)
    for field in ("title", "description", "start_date", "end_date", "is_active"):
        value = getattr(data, field)
        if value is not None:
            setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return _to_response(db, course)


@router.post("/{class_id}/regenerate-code", response_model=ClassResponse)
async def regenerate_code(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    course = _get_owned_class(db, class_id, teacher)
    course.enrollment_key = _generate_join_code(db)
    db.commit()
    db.refresh(course)
    return _to_response(db, course)


# --- roster -----------------------------------------------------------------
@router.get("/{class_id}/members", response_model=list[MemberResponse])
async def list_members(
    class_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    _get_owned_class(db, class_id, teacher)
    rows = db.query(CourseEnrollment, User).join(
        User, User.id == CourseEnrollment.user_id
    ).filter(CourseEnrollment.course_id == class_id).all()
    return [
        MemberResponse(
            user_id=u.id,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            email=u.email,
            role=e.role,
            status=e.status,
            enrolled_at=e.time_created,
        )
        for e, u in rows
    ]


@router.delete("/{class_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    class_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_teacher),
):
    _get_owned_class(db, class_id, teacher)
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == class_id,
        CourseEnrollment.user_id == user_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(enrollment)
    db.commit()


# --- student: join / list / leave -------------------------------------------
@router.post("/join", response_model=ClassResponse)
async def join_class(
    data: JoinClassRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    code = data.code.strip().upper()
    course = db.query(Course).filter(Course.enrollment_key == code).first()
    if not course or not course.is_active:
        raise HTTPException(status_code=404, detail="Invalid or inactive class code")
    if course.teacher_id == user.id:
        raise HTTPException(status_code=400, detail="You teach this class")

    existing = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == course.id,
        CourseEnrollment.user_id == user.id,
    ).first()
    if existing:
        if existing.status != "active":
            existing.status = "active"
            db.commit()
        else:
            raise HTTPException(status_code=409, detail="Already enrolled")
    else:
        db.add(CourseEnrollment(
            course_id=course.id,
            user_id=user.id,
            role="student",
            status="active",
        ))
        db.commit()
    db.refresh(course)
    return _to_response(db, course)


@router.get("/mine/enrolled", response_model=list[ClassResponse])
def my_enrolled_classes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    rows = db.query(Course).join(
        CourseEnrollment, CourseEnrollment.course_id == Course.id
    ).filter(
        CourseEnrollment.user_id == user.id,
        CourseEnrollment.status == "active",
    ).order_by(Course.created_at.desc()).all()
    return [_to_response(db, c) for c in rows]


# --- leaderboard ------------------------------------------------------------
@router.get("/{class_id}/leaderboard", response_model=list[LeaderboardEntry])
def class_leaderboard(
    class_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    """Top 10 students in a class by total quiz score — names only.

    Only members of the class (its students, or its teacher/admin) may view it.
    Scores are never returned, only the ranked names.
    """
    course = db.query(Course).filter(Course.id == class_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Class not found")

    # Access gate (mirrors get_class).
    if user.role == "student":
        enrolled = db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id == class_id,
            CourseEnrollment.user_id == user.id,
            CourseEnrollment.status == "active",
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this class")
    elif user.role == "teacher" and course.teacher_id != user.id:
        raise HTTPException(status_code=403, detail="Not your class")

    # Per-user total quiz score across this class's quizzes.
    score_sub = (
        db.query(
            QuestSubmission.user_id.label("uid"),
            func.coalesce(func.sum(QuestSubmission.score), 0).label("total"),
        )
        .join(Quest, Quest.quest_id == QuestSubmission.quest_id)
        .filter(Quest.course_id == class_id)
        .group_by(QuestSubmission.user_id)
        .subquery()
    )

    rows = (
        db.query(User, func.coalesce(score_sub.c.total, 0).label("total"))
        .join(CourseEnrollment, CourseEnrollment.user_id == User.id)
        .outerjoin(score_sub, score_sub.c.uid == User.id)
        .filter(
            CourseEnrollment.course_id == class_id,
            CourseEnrollment.status == "active",
            CourseEnrollment.role == "student",
        )
        .order_by(func.coalesce(score_sub.c.total, 0).desc(), User.first_name.asc())
        .limit(10)
        .all()
    )

    def _name(u: User) -> str:
        full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        return full or u.username

    return [LeaderboardEntry(rank=i + 1, name=_name(u)) for i, (u, _total) in enumerate(rows)]


@router.post("/{class_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_class(
    class_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    enrollment = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == class_id,
        CourseEnrollment.user_id == user.id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled")
    db.delete(enrollment)
    db.commit()
