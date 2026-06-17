from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

# Enum schemas for API responses
class QuestTypeResponse(str, Enum):
    DAILY_LOGIN = "daily_login"
    FEED_PET = "feed_pet"
    EARN_XP = "earn_xp"
    COMPLETE_QUIZ = "complete_quiz"

class QuestStatusResponse(str, Enum):
    AVAILABLE = "available"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"

# Base schemas
class DailyQuestBase(BaseModel):
    quest_type: QuestTypeResponse
    title: str
    description: str
    xp_reward: int
    target_count: int = 1
    criteria: Optional[Dict[str, Any]] = None
    is_active: bool = True
    priority: int = 1
    difficulty_level: int = 1

class DailyQuestCreate(DailyQuestBase):
    additional_rewards: Optional[Dict[str, Any]] = None

class DailyQuestResponse(DailyQuestBase):
    quest_id: int
    additional_rewards: Optional[Dict[str, Any]] = None
    created_at: datetime
    last_updated: datetime

    class Config:
        from_attributes = True

# User Daily Quest schemas
class UserDailyQuestBase(BaseModel):
    current_progress: int = 0
    target_progress: int
    quest_metadata: Optional[Dict[str, Any]] = None

class UserDailyQuestCreate(UserDailyQuestBase):
    user_id: int
    daily_quest_id: int
    quest_date: datetime
    expires_at: Optional[datetime] = None

class UserDailyQuestResponse(UserDailyQuestBase):
    id: int
    user_id: int
    daily_quest_id: int
    assigned_date: datetime
    quest_date: datetime
    status: QuestStatusResponse
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    xp_awarded: int = 0
    rewards_claimed: bool = False
    created_at: datetime
    last_updated: datetime
    
    # Include the quest details
    daily_quest: DailyQuestResponse

    class Config:
        from_attributes = True

# Progress tracking schemas
class DailyQuestProgressCreate(BaseModel):
    action_type: str
    action_data: Optional[Dict[str, Any]] = None
    progress_increment: int

class DailyQuestProgressResponse(BaseModel):
    id: int
    user_daily_quest_id: int
    action_type: str
    action_data: Optional[Dict[str, Any]] = None
    progress_increment: int
    recorded_at: datetime

    class Config:
        from_attributes = True

# Summary schemas
class DailyQuestSummary(BaseModel):
    date: str
    total_quests: int
    completed_quests: int
    completion_percentage: float
    total_xp_earned: int
    quests: List[UserDailyQuestResponse]

class QuestCompletionRequest(BaseModel):
    quest_type: QuestTypeResponse

class QuestCompletionResponse(BaseModel):
    success: bool
    message: str
    xp_awarded: int = 0
    quest: Optional[UserDailyQuestResponse] = None
