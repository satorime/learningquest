# This file makes the models directory a Python package
# Import models only when explicitly requested rather than on module initialization
# to prevent duplicate table definitions 

# Import all models here to ensure they are registered with SQLAlchemy
# IMPORTANT: Import User first before ActivityLog to ensure proper foreign key resolution
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.models.course import Course
from app.models.enrollment import CourseEnrollment
from app.models.auth import Token, MoodleConfig
from app.models.quest import Quest, StudentProgress, ExperiencePoints
from app.models.leaderboard import Leaderboard, LeaderboardEntry, StudentProgress, ExperiencePoint
from app.models.daily_quest import DailyQuest, UserDailyQuest, DailyQuestProgress, QuestTypeEnum, QuestStatusEnum
from app.models.streak import UserStreak
from app.models.badge import Badge, UserBadge
from app.models.virtual_pet import VirtualPet, PetAccessory
from app.models.setting import PlatformSetting
from app.models.quiz import QuizQuestion, QuizOption, QuestSubmission, SubmissionAnswer

# This file ensures proper loading order of models when using relationships