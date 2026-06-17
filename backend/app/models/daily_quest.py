from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM
from datetime import datetime
import enum

from app.database.connection import Base

# Quest type enum - all available quest types
class QuestTypeEnum(enum.Enum):
    DAILY_LOGIN = "daily_login"
    FEED_PET = "feed_pet"
    EARN_XP = "earn_xp"
    COMPLETE_QUIZ = "complete_quiz"

# Quest status enum
class QuestStatusEnum(enum.Enum):
    AVAILABLE = "available"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"

# Create ENUM types for PostgreSQL.
# create_type=True so Base.metadata.create_all() emits CREATE TYPE on a fresh DB
# (checkfirst makes it idempotent and avoids duplicate-type errors).
quest_type_enum = ENUM(
    'daily_login', 'feed_pet', 'earn_xp', 'complete_quiz',
    name='questtypeenum',
    create_type=True
)
quest_status_enum = ENUM(
    'available', 'active', 'completed', 'expired',
    name='queststatusenum',
    create_type=True
)

class DailyQuest(Base):
    """Daily quest template table - defines available quest types"""
    __tablename__ = "dailyquest"

    quest_id = Column(Integer, primary_key=True, index=True)
    quest_type = Column(quest_type_enum, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    xp_reward = Column(Integer, nullable=False)
    additional_rewards = Column(JSON)
    target_count = Column(Integer, nullable=False, default=1)
    criteria = Column(JSON)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=1)
    difficulty_level = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user_quests = relationship("UserDailyQuest", back_populates="daily_quest")

class UserDailyQuest(Base):
    """User's daily quest instances - tracks individual user quest progress"""
    __tablename__ = "userdailyquest"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    daily_quest_id = Column(Integer, ForeignKey("dailyquest.quest_id", ondelete="CASCADE"), nullable=False)
    assigned_date = Column(DateTime, default=datetime.utcnow)
    quest_date = Column(DateTime, nullable=False)
    status = Column(quest_status_enum, nullable=False, default=QuestStatusEnum.AVAILABLE)
    current_progress = Column(Integer, nullable=False, default=0)
    target_progress = Column(Integer, nullable=False)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    expires_at = Column(DateTime)
    xp_awarded = Column(Integer, nullable=False, default=0)
    rewards_claimed = Column(Boolean, default=False)
    quest_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    daily_quest = relationship("DailyQuest", back_populates="user_quests")
    progress_records = relationship("DailyQuestProgress", back_populates="user_quest")

class DailyQuestProgress(Base):
    """Tracks detailed progress for daily quests"""
    __tablename__ = "dailyquestprogress"

    id = Column(Integer, primary_key=True, index=True)
    user_daily_quest_id = Column(Integer, ForeignKey("userdailyquest.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False)
    action_data = Column(JSON)
    progress_increment = Column(Integer, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user_quest = relationship("UserDailyQuest", back_populates="progress_records")
