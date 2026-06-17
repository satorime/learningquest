from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base

# Import after to avoid circular imports
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Badge(Base):
    __tablename__ = "badges"
    
    badge_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    badge_type = Column(String(50), nullable=False)
    image_url = Column(Text, nullable=True, default="/badges/default-badge.png")
    criteria = Column(JSONB, nullable=False)  # JSONB in PostgreSQL
    exp_value = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    user_badges = relationship("UserBadge", back_populates="badge")


class UserBadge(Base):
    __tablename__ = "user_badges"
    
    user_badge_id = Column(Integer, primary_key=True, index=True)  # Changed from 'id'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id = Column(Integer, ForeignKey("badges.badge_id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now())  # Changed from 'earned_at'
    awarded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # New field
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True)  # New field
    # False until the student has seen the earn popup (lets missed/offline awards
    # pop on their next visit).
    popup_seen = Column(Boolean, nullable=False, server_default="false")

    # Relationships
    user = relationship("User", back_populates="earned_badges", foreign_keys=[user_id])
    badge = relationship("Badge", back_populates="user_badges")
    awarded_by_user = relationship("User", foreign_keys=[awarded_by])  # Who awarded this badge
    course = relationship("Course", foreign_keys=[course_id])  # Which course this badge was earned in
    
    # Ensure user can only earn each badge once (matches your UNIQUE constraint)
    __table_args__ = (UniqueConstraint('user_id', 'badge_id', name='user_badges_user_id_badge_id_key'),)
    __table_args__ = (
        {'extend_existing': True}
    )
