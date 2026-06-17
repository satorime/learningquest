from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    # Nullable: Google-only accounts have no local password.
    password_hash = Column(String(255), nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    profile_image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    settings = Column(JSONB, server_default='{}')

    # Authentication
    auth_provider = Column(String(20), nullable=False, server_default="local")  # local | google | both
    google_id = Column(String(255), unique=True, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    # Email verification (manual sign-ups must confirm a code)
    is_verified = Column(Boolean, nullable=False, server_default="false")
    verification_code = Column(String(10), nullable=True)
    verification_code_expires = Column(DateTime(timezone=True), nullable=True)
    # Pending email change — the new address must be confirmed with a code sent
    # to it before it replaces the current email.
    pending_email = Column(String(255), nullable=True)
    email_change_code = Column(String(10), nullable=True)
    email_change_expires = Column(DateTime(timezone=True), nullable=True)

    # Moodle (legacy — removed incrementally as native paths replace them)
    moodle_user_id = Column(Integer, nullable=True)
    user_token = Column(Text, unique=True, nullable=True)
    
    # Add check constraint on role
    __table_args__ = (
        CheckConstraint(
            "role IN ('student', 'teacher', 'admin')",
            name='users_role_check'
        ),
    )
      # Add relationships
    tokens = relationship("Token", back_populates="user", cascade="all, delete-orphan")
    enrollments = relationship("CourseEnrollment", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")
    earned_badges = relationship("UserBadge", back_populates="user", cascade="all, delete-orphan", foreign_keys="UserBadge.user_id")