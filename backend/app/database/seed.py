from sqlalchemy.orm import Session
from app.models.user import User
from app.models.course import Course
from app.utils.auth import get_password_hash
from app.config import ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD


def _ensure_admin(db: Session) -> User:
    """Create the bootstrap admin account if no admin exists yet."""
    admin = db.query(User).filter(User.role == "admin").first()
    if admin:
        return admin

    admin = User(
        username=ADMIN_USERNAME,
        email=ADMIN_EMAIL,
        password_hash=get_password_hash(ADMIN_PASSWORD),
        first_name="Platform",
        last_name="Admin",
        role="admin",
        auth_provider="local",
        is_active=True,
        is_verified=True,
    )
    db.add(admin)
    db.flush()
    return admin


def seed_initial_data(db: Session):
    """Seed initial data: always ensure an admin exists; add dev samples on a
    fresh database only."""
    _ensure_admin(db)

    # If we already have non-admin users, assume the DB is seeded.
    if db.query(User).filter(User.role != "admin").count() > 0:
        db.commit()
        return

    # --- Development sample data (fresh DB only) ---
    teacher = User(
        username="teacher1",
        email="teacher@example.com",
        password_hash=get_password_hash("password123"),
        first_name="Teacher",
        last_name="User",
        role="teacher",
        auth_provider="local",
        is_verified=True,
    )
    db.add(teacher)
    db.flush()

    student = User(
        username="student1",
        email="student@example.com",
        password_hash=get_password_hash("password123"),
        first_name="Student",
        last_name="User",
        role="student",
        auth_provider="local",
        is_verified=True,
    )
    db.add(student)
    db.flush()

    courses = [
        Course(
            title="Introduction to Computer Science",
            description="Learn the fundamentals of computer science and programming",
            course_code="CS101",
            teacher_id=teacher.id,
        ),
        Course(
            title="Web Development Fundamentals",
            description="Build and design websites using HTML, CSS and JavaScript",
            course_code="WEB101",
            teacher_id=teacher.id,
        ),
        Course(
            title="Data Structures and Algorithms",
            description="Study common data structures and algorithms used in computer science",
            course_code="CS201",
            teacher_id=teacher.id,
        ),
    ]
    for course in courses:
        db.add(course)

    db.commit()
