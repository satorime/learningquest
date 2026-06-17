from sqlalchemy import Column, Integer, String, Text, Boolean, SmallInteger, ForeignKey, DateTime, Float, UniqueConstraint, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Quest(Base):
    __tablename__ = "quests"
    
    quest_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    exp_reward = Column(Integer, nullable=False, default=0)
    quest_type = Column(String(20), nullable=False)
    validation_method = Column(String(50), nullable=False)
    validation_criteria = Column(JSONB)
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    # Lifecycle: draft -> published -> archived
    status = Column(String(20), nullable=False, server_default="draft")
    difficulty_level = Column(SmallInteger, default=1)
    # Optional time limit (minutes) the student has once they start the quiz.
    time_limit_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    moodle_activity_id = Column(Integer, nullable=True, index=True)

class QuestProgress(Base):
    __tablename__ = "quest_progress"

    progress_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quest_id = Column(Integer, ForeignKey("quests.quest_id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="not_started")
    progress_percent = Column(SmallInteger, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    validation_notes = Column(Text, nullable=True)
    
    # Engagement tracking columns
    engagement_stage = Column(String(20), nullable=False, default="not_started")
    first_interaction_at = Column(DateTime(timezone=True), nullable=True)
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)
    interaction_count = Column(Integer, nullable=False, default=0)
    engagement_score = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        # Composite unique constraint for (user_id, quest_id)
        UniqueConstraint('user_id', 'quest_id', name='uq_user_quest'),
    )

    # Relationships
    user = relationship("User")
    quest = relationship("Quest")

class StudentProgress(Base):
    __tablename__ = "student_progress"
    progress_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    course_id = Column(Integer, nullable=True)  # Allow NULL for global progress
    total_exp = Column(Integer, nullable=False, default=0)
    quests_completed = Column(Integer, nullable=False, default=0)
    badges_earned = Column(Integer, nullable=False, default=0)
    engagement_score = Column(Numeric(5, 2), nullable=True)
    study_hours = Column(Numeric(8, 2), nullable=False, default=0)
    last_activity = Column(DateTime(timezone=True), nullable=True)
    streak_days = Column(Integer, nullable=False, default=0)

class ExperiencePoints(Base):
    __tablename__ = "experience_points"
    exp_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    course_id = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=True)
    awarded_at = Column(DateTime(timezone=True), default=func.now())
    awarded_by = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

class QuestEngagementEvent(Base):
    __tablename__ = "quest_engagement_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    quest_progress_id = Column(Integer, ForeignKey("quest_progress.progress_id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSONB, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    engagement_points = Column(Integer, nullable=False, default=0)
    
    # Relationships
    quest_progress = relationship("QuestProgress")



