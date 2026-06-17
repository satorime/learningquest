from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, cast, Date
import logging

from app.models.daily_quest import DailyQuest, UserDailyQuest, DailyQuestProgress, QuestStatusEnum, QuestTypeEnum
from app.models.user import User
from app.models.quest import ExperiencePoints, StudentProgress
from app.models.streak import UserStreak
from app.services.badge_service import BadgeService

logger = logging.getLogger(__name__)

class DailyQuestService:
    def __init__(self, db: Session):
        self.db = db

    def seed_daily_login_quest(self) -> Dict[str, Any]:
        """
        Seed the database with all daily quest templates.
        """
        results = []
        
        # Study-habit daily quests. Each grants food (the pet-feeding consumable)
        # in addition to XP, to tie daily studying to caring for the pet.
        quest_templates = [
            {
                "quest_type": QuestTypeEnum.DAILY_LOGIN.value,
                "title": "Daily Check-In",
                "description": "Show up to learn — log in today to keep your study habit going!",
                "xp_reward": 10,
                "additional_rewards": {"food": 2},
                "target_count": 1,
                "criteria": {"action": "login", "count": 1},
                "priority": 1,
                "difficulty_level": 1
            },
            {
                "quest_type": QuestTypeEnum.COMPLETE_QUIZ.value,
                "title": "Knowledge Check",
                "description": "Complete any quiz or assignment from your classes today.",
                "xp_reward": 15,
                "additional_rewards": {"food": 2},
                "target_count": 1,
                "criteria": {"action": "complete_quiz", "count": 1},
                "priority": 2,
                "difficulty_level": 1
            },
            {
                "quest_type": QuestTypeEnum.EARN_XP.value,
                "title": "Keep Studying",
                "description": "Earn 50 XP from your learning activities today.",
                "xp_reward": 25,
                "additional_rewards": {"food": 2},
                "target_count": 50,  # Need to earn 50 XP from other activities
                "criteria": {"action": "earn_xp", "count": 50},
                "priority": 3,
                "difficulty_level": 2
            }
        ]

        for template_data in quest_templates:
            # Upsert: update existing templates so re-seeding refreshes copy/rewards.
            existing_quest = self.db.query(DailyQuest).filter(
                DailyQuest.quest_type == template_data["quest_type"]
            ).first()

            try:
                if existing_quest:
                    existing_quest.title = template_data["title"]
                    existing_quest.description = template_data["description"]
                    existing_quest.xp_reward = template_data["xp_reward"]
                    existing_quest.additional_rewards = template_data["additional_rewards"]
                    existing_quest.target_count = template_data["target_count"]
                    existing_quest.criteria = template_data["criteria"]
                    existing_quest.priority = template_data["priority"]
                    existing_quest.difficulty_level = template_data["difficulty_level"]
                    existing_quest.is_active = True
                    existing_quest.last_updated = datetime.utcnow()
                    self.db.commit()
                    results.append({
                        "quest_type": template_data["quest_type"],
                        "success": True,
                        "message": "Quest template updated",
                        "quest_id": existing_quest.quest_id
                    })
                    continue

                daily_quest = DailyQuest(
                    quest_type=template_data["quest_type"],
                    title=template_data["title"],
                    description=template_data["description"],
                    xp_reward=template_data["xp_reward"],
                    additional_rewards=template_data["additional_rewards"],
                    target_count=template_data["target_count"],
                    criteria=template_data["criteria"],
                    is_active=True,
                    priority=template_data["priority"],
                    difficulty_level=template_data["difficulty_level"],
                    created_at=datetime.utcnow(),
                    last_updated=datetime.utcnow()
                )
                self.db.add(daily_quest)
                self.db.commit()
                self.db.refresh(daily_quest)

                logger.info(f"Created quest template {template_data['quest_type']} with ID: {daily_quest.quest_id}")
                results.append({
                    "quest_type": template_data["quest_type"],
                    "success": True,
                    "message": f"Quest template {template_data['quest_type']} created successfully",
                    "quest_id": daily_quest.quest_id
                })
            except Exception as e:
                self.db.rollback()
                logger.error(f"Error creating quest template {template_data['quest_type']}: {e}")
                results.append({
                    "quest_type": template_data["quest_type"],
                    "success": False,
                    "message": f"Error creating quest template: {str(e)}"
                })

        # Retire any legacy templates not in the study set (e.g. feed_pet) so
        # they stop being generated for students.
        study_types = [t["quest_type"] for t in quest_templates]
        try:
            self.db.query(DailyQuest).filter(
                DailyQuest.quest_type.notin_(study_types),
                DailyQuest.is_active == True,
            ).update({DailyQuest.is_active: False}, synchronize_session=False)
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error retiring legacy quest templates: {e}")

        return {
            "success": True,
            "message": f"Processed {len(quest_templates)} quest templates",
            "results": results
        }

    def generate_daily_login_quest_for_user(self, user_id: int, target_date: date = None) -> Optional[UserDailyQuest]:
        """
        Generate a daily login quest for a specific user on a specific date.
        """
        if target_date is None:
            target_date = date.today()

        # Check if user already has a daily login quest for this date
        existing_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                DailyQuest.quest_type == QuestTypeEnum.DAILY_LOGIN.value,
                cast(UserDailyQuest.quest_date, Date) == target_date
            )
        ).first()

        if existing_quest:
            logger.info(f"User {user_id} already has daily login quest for {target_date}")
            return existing_quest

        # Get the daily login quest template
        quest_template = self.db.query(DailyQuest).filter(
            and_(
                DailyQuest.quest_type == QuestTypeEnum.DAILY_LOGIN.value,
                DailyQuest.is_active == True
            )
        ).first()

        if not quest_template:
            logger.error("No active daily login quest template found")
            return None

        # Calculate expiration (end of day)
        expires_at = datetime.combine(target_date + timedelta(days=1), datetime.min.time())

        # Create user daily quest record
        user_quest = UserDailyQuest(
            user_id=user_id,
            daily_quest_id=quest_template.quest_id,
            quest_date=datetime.combine(target_date, datetime.min.time()),
            status=QuestStatusEnum.AVAILABLE.value,
            current_progress=0,
            target_progress=quest_template.target_count,
            expires_at=expires_at,
            quest_metadata=quest_template.criteria,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )

        try:
            self.db.add(user_quest)
            self.db.commit()
            self.db.refresh(user_quest)
            
            logger.info(f"Generated daily login quest for user {user_id} on {target_date}")
            return user_quest
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error generating daily login quest: {e}")
            raise

    def complete_daily_login_quest(self, user_id: int) -> Dict[str, Any]:
        """
        Complete the daily login quest for a user.
        Returns information about the completion and XP awarded.
        """
        today = date.today()
        
        # Find the user's daily login quest for today
        user_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                DailyQuest.quest_type == QuestTypeEnum.DAILY_LOGIN.value,
                cast(UserDailyQuest.quest_date, Date) == today,
                UserDailyQuest.status == QuestStatusEnum.AVAILABLE.value
            )
        ).first()

        if not user_quest:
            # Generate the quest if it doesn't exist
            user_quest = self.generate_daily_login_quest_for_user(user_id, today)
            if not user_quest:
                return {
                    "success": False,
                    "message": "Could not generate daily login quest",
                    "xp_awarded": 0
                }

        # Check if already completed
        if user_quest.status == QuestStatusEnum.COMPLETED.value:
            return {
                "success": False,
                "message": "Daily login quest already completed today",
                "xp_awarded": 0
            }

        # Complete the quest
        user_quest.status = QuestStatusEnum.COMPLETED.value
        user_quest.current_progress = user_quest.target_progress
        user_quest.completed_at = datetime.utcnow()
        user_quest.started_at = user_quest.started_at or datetime.utcnow()
        user_quest.xp_awarded = user_quest.daily_quest.xp_reward
        user_quest.last_updated = datetime.utcnow()

        # Record progress
        progress_record = DailyQuestProgress(
            user_daily_quest_id=user_quest.id,
            action_type="daily_login",
            action_data={"login_time": datetime.utcnow().isoformat()},
            progress_increment=1,
            recorded_at=datetime.utcnow()
        )
        self.db.add(progress_record)

        # Award XP
        xp_record = ExperiencePoints(
            user_id=user_id,
            course_id=None,
            amount=user_quest.daily_quest.xp_reward,
            source_type="daily_quest",
            source_id=user_quest.daily_quest.quest_id,
            awarded_at=datetime.utcnow(),
            notes=f"Daily quest: {user_quest.daily_quest.title}"
        )
        self.db.add(xp_record)        # Update student progress
        self._update_student_progress(user_id, user_quest.daily_quest.xp_reward)

        try:
            self.db.commit()
            self._award_quest_food(user_id, user_quest.daily_quest)
            logger.info(f"Completed daily login quest for user {user_id}, awarded {user_quest.daily_quest.xp_reward} XP")

            # Check for badge achievements after quest completion
            self._check_badges_after_quest_completion(user_id)

            return {
                "success": True,
                "message": "Daily login quest completed successfully!",
                "xp_awarded": user_quest.daily_quest.xp_reward,
                "quest": user_quest
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error completing daily login quest: {e}")
            raise

    def get_user_daily_quests(self, user_id: int, target_date: date = None) -> List[UserDailyQuest]:
        """Get all daily quests for a user on a specific date."""
        if target_date is None:
            target_date = date.today()
        
        return self.db.query(UserDailyQuest).join(DailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                cast(UserDailyQuest.quest_date, Date) == target_date,
                DailyQuest.is_active == True,  # hide retired templates (e.g. feed_pet)
            )
        ).order_by(DailyQuest.priority.desc()).all()

    def get_user_quest_summary(self, user_id: int) -> Dict[str, Any]:
        """Get user's daily quest summary for today."""
        today = date.today()
        
        # Ensure user has all daily quests for today
        self.generate_all_daily_quests_for_user(user_id, today)
        
        # Get all quests for today
        quests = self.get_user_daily_quests(user_id, today)
        
        total_quests = len(quests)
        completed_quests = len([q for q in quests if q.status == QuestStatusEnum.COMPLETED.value])
        total_xp_earned = sum(q.xp_awarded for q in quests if q.status == QuestStatusEnum.COMPLETED.value)
        
        return {
            "date": today.isoformat(),
            "total_quests": total_quests,
            "completed_quests": completed_quests,
            "completion_percentage": (completed_quests / total_quests * 100) if total_quests > 0 else 0,
            "total_xp_earned": total_xp_earned,
            "quests": quests
        }

    def _update_student_progress(self, user_id: int, xp_amount: int):
        """Update student progress and handle login streaks."""
        progress = self.db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).first()

        if progress:
            progress.total_exp += xp_amount
            progress.last_activity = datetime.utcnow()
        else:
            # Create new progress record
            progress = StudentProgress(
                user_id=user_id,
                course_id=None,
                total_exp=xp_amount,
                quests_completed=0,
                badges_earned=0,
                study_hours=0.0,
                streak_days=0,  # Will be updated by streak system
                last_activity=datetime.utcnow()
            )
            self.db.add(progress)

        # Update login streak for daily login quests
        self._update_login_streak(user_id)

    def _update_login_streak(self, user_id: int):
        """Update login streak for daily login quests using the streak table."""
        today = date.today()
        
        # Get or create login streak record
        login_streak = self.db.query(UserStreak).filter(
            and_(
                UserStreak.user_id == user_id,
                UserStreak.streak_type == "daily_login"
            )
        ).first()
        
        if not login_streak:
            # Create new streak record
            login_streak = UserStreak(
                user_id=user_id,
                streak_type="daily_login",
                current_streak=1,
                longest_streak=1,
                last_activity_date=today,
                start_date=today
            )
            self.db.add(login_streak)
        else:
            # Check if this is a consecutive day
            yesterday = today - timedelta(days=1)
            
            if login_streak.last_activity_date == yesterday:
                # Consecutive day - increment streak
                login_streak.current_streak += 1
                login_streak.longest_streak = max(login_streak.longest_streak, login_streak.current_streak)
            elif login_streak.last_activity_date == today:
                # Same day - no change (already logged in today)
                return
            else:
                # Streak broken - reset
                login_streak.current_streak = 1
                login_streak.start_date = today
            
            login_streak.last_activity_date = today

        # Update student progress with current streak
        progress = self.db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).first()
        
        if progress:
            progress.streak_days = login_streak.current_streak

    def expire_old_quests(self):
        """Mark expired quests as expired. Should be run daily via cron job."""
        now = datetime.utcnow()
        expired_quests = self.db.query(UserDailyQuest).filter(
            and_(
                UserDailyQuest.status == QuestStatusEnum.AVAILABLE.value,
                UserDailyQuest.expires_at < now
            )
        ).all()
        
        for quest in expired_quests:
            quest.status = QuestStatusEnum.EXPIRED.value
            quest.last_updated = now
        
        if expired_quests:
            self.db.commit()
            logger.info(f"Expired {len(expired_quests)} old quests")

    def generate_all_daily_quests_for_user(self, user_id: int, target_date: date = None) -> List[UserDailyQuest]:
        """
        Generate all types of daily quests for a specific user on a specific date.
        """
        if target_date is None:
            target_date = date.today()

        generated_quests = []

        # Get all active quest templates
        quest_templates = self.db.query(DailyQuest).filter(
            DailyQuest.is_active == True
        ).order_by(DailyQuest.priority).all()

        for template in quest_templates:
            # Check if user already has this quest type for this date
            existing_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
                and_(
                    UserDailyQuest.user_id == user_id,
                    DailyQuest.quest_type == template.quest_type,
                    cast(UserDailyQuest.quest_date, Date) == target_date
                )
            ).first()

            if existing_quest:
                logger.info(f"User {user_id} already has {template.quest_type} quest for {target_date}")
                generated_quests.append(existing_quest)
                continue

            # Calculate expiration (end of day)
            expires_at = datetime.combine(target_date + timedelta(days=1), datetime.min.time())            # Create user daily quest record
            user_quest = UserDailyQuest(
                user_id=user_id,
                daily_quest_id=template.quest_id,
                quest_date=target_date,
                status=QuestStatusEnum.ACTIVE.value,
                current_progress=0,
                target_progress=template.target_count,
                expires_at=expires_at,
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow()
            )

            try:
                self.db.add(user_quest)
                self.db.commit()
                self.db.refresh(user_quest)
                
                logger.info(f"Generated {template.quest_type} quest for user {user_id} on {target_date}")
                generated_quests.append(user_quest)
            except Exception as e:
                self.db.rollback()
                logger.error(f"Error generating {template.quest_type} quest for user {user_id}: {e}")

        return generated_quests

    def complete_quest_by_type(self, user_id: int, quest_type: str) -> Dict[str, Any]:
        """
        Complete a daily quest of a specific type for a user.
        """
        today = date.today()
        
        # Find the user's active quest for this type and date
        user_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                DailyQuest.quest_type == quest_type,
                cast(UserDailyQuest.quest_date, Date) == today,
                UserDailyQuest.status == QuestStatusEnum.ACTIVE.value
            )
        ).first()

        if not user_quest:
            return {
                "success": False,
                "message": f"No active {quest_type} quest found for today",
                "xp_awarded": 0
            }

        # Check if already completed
        if user_quest.status == QuestStatusEnum.COMPLETED.value:
            return {
                "success": False,
                "message": f"{quest_type.replace('_', ' ').title()} quest already completed today",
                "xp_awarded": 0
            }

        # Mark quest as completed
        user_quest.status = QuestStatusEnum.COMPLETED.value
        user_quest.current_progress = user_quest.target_progress
        user_quest.completed_at = datetime.utcnow()
        user_quest.last_updated = datetime.utcnow()
        user_quest.xp_awarded = user_quest.daily_quest.xp_reward

        try:
            # Award XP to user
            self._award_xp_to_user(user_id, user_quest.daily_quest.xp_reward)
            # Update student progress to add XP to total
            self._update_student_progress(user_id, user_quest.daily_quest.xp_reward)
            # Update streak if it's a login quest
            if quest_type == QuestTypeEnum.DAILY_LOGIN.value:
                self._update_user_streak(user_id)
            
            self.db.commit()
            self._award_quest_food(user_id, user_quest.daily_quest)

            logger.info(f"User {user_id} completed {quest_type} quest and earned {user_quest.daily_quest.xp_reward} XP")

            # Check for badge achievements after quest completion
            self._check_badges_after_quest_completion(user_id)

            return {
                "success": True,
                "message": f"{quest_type.replace('_', ' ').title()} quest completed successfully!",
                "xp_awarded": user_quest.daily_quest.xp_reward,
                "quest": user_quest
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error completing {quest_type} quest for user {user_id}: {e}")
            raise

    def complete_feed_pet_quest(self, user_id: int) -> Dict[str, Any]:
        """Complete the feed pet quest for a user."""
        return self.complete_quest_by_type(user_id, QuestTypeEnum.FEED_PET.value)

    def complete_earn_xp_quest(self, user_id: int, xp_earned: int = 0) -> Dict[str, Any]:
        """
        Update progress on the earn XP quest for a user.
        This quest requires earning a certain amount of XP from other activities.
        """
        today = date.today()
        
        # Find the user's active earn XP quest for today
        user_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                DailyQuest.quest_type == QuestTypeEnum.EARN_XP.value,
                cast(UserDailyQuest.quest_date, Date) == today,
                UserDailyQuest.status == QuestStatusEnum.ACTIVE.value
            )
        ).first()

        if not user_quest:
            # Try to generate the earn XP quest if it doesn't exist
            self.generate_all_daily_quests_for_user(user_id, today)
            
            # Try to find the quest again
            user_quest = self.db.query(UserDailyQuest).join(DailyQuest).filter(
                and_(
                    UserDailyQuest.user_id == user_id,
                    DailyQuest.quest_type == QuestTypeEnum.EARN_XP.value,
                    cast(UserDailyQuest.quest_date, Date) == today,
                    UserDailyQuest.status == QuestStatusEnum.ACTIVE.value
                )
            ).first()
            
            if not user_quest:
                return {
                    "success": False,
                    "message": "No active earn XP quest found for today",
                    "xp_awarded": 0
                }

        # Check if already completed
        if user_quest.status == QuestStatusEnum.COMPLETED.value:
            return {
                "success": False,
                "message": "Earn XP quest already completed today",
                "xp_awarded": 0
            }

        # Update progress
        user_quest.current_progress = min(user_quest.current_progress + xp_earned, user_quest.target_progress)
        user_quest.last_updated = datetime.utcnow()

        # Check if quest is now complete
        if user_quest.current_progress >= user_quest.target_progress:
            user_quest.status = QuestStatusEnum.COMPLETED.value
            user_quest.completed_at = datetime.utcnow()
            user_quest.xp_awarded = user_quest.daily_quest.xp_reward            # Award quest completion XP (separate from the XP that counted toward the quest)
            self._award_xp_to_user(user_id, user_quest.daily_quest.xp_reward)
            # Update student progress to add XP to total
            self._update_student_progress(user_id, user_quest.daily_quest.xp_reward)
            
            try:
                self.db.commit()
                self._award_quest_food(user_id, user_quest.daily_quest)

                logger.info(f"User {user_id} completed earn XP quest and earned {user_quest.daily_quest.xp_reward} bonus XP")

                # Check for badge achievements after quest completion
                self._check_badges_after_quest_completion(user_id)
                
                return {
                    "success": True,
                    "message": "Earn XP quest completed! Bonus XP awarded!",
                    "xp_awarded": user_quest.daily_quest.xp_reward,
                    "quest": user_quest
                }
            except Exception as e:
                self.db.rollback()
                logger.error(f"Error completing earn XP quest for user {user_id}: {e}")
                raise
        else:
            # Quest not yet complete, just update progress
            try:
                self.db.commit()
                
                return {
                    "success": True,
                    "message": f"Earn XP quest progress updated: {user_quest.current_progress}/{user_quest.target_progress}",
                    "xp_awarded": 0,
                    "quest": user_quest
                }
            except Exception as e:
                self.db.rollback()
                logger.error(f"Error updating earn XP quest progress for user {user_id}: {e}")
                raise

    def _award_quest_food(self, user_id: int, daily_quest) -> int:
        """Grant the quest's food reward (from additional_rewards) to the pet."""
        try:
            food = 0
            if daily_quest and daily_quest.additional_rewards:
                food = daily_quest.additional_rewards.get("food", 0) or 0
            if food:
                from app.services.pet_service import add_food
                return add_food(self.db, user_id, food)
        except Exception as e:  # noqa: BLE001 - food reward is best-effort
            logger.warning(f"Could not award quest food to user {user_id}: {e}")
        return 0

    def _award_xp_to_user(self, user_id: int, xp_amount: int):
        """Award XP to a user and create an experience points record."""
        xp_record = ExperiencePoints(
            user_id=user_id,
            course_id=None,
            amount=xp_amount,
            source_type="daily_quest",
            awarded_at=datetime.utcnow(),
            notes="Daily quest completion"
        )
        self.db.add(xp_record)
        # Note: This method only creates the ExperiencePoints record
        # Callers should also call _update_student_progress() to update total XP

    def _update_user_streak(self, user_id: int):
        """Update the user's login streak."""
        today = date.today()
        
        # Get or create streak record
        streak = self.db.query(UserStreak).filter(
            and_(
                UserStreak.user_id == user_id,
                UserStreak.streak_type == "daily_login"
            )
        ).first()
        
        if not streak:
            # Create new streak record
            streak = UserStreak(
                user_id=user_id,
                streak_type="daily_login",
                current_streak=1,
                longest_streak=1,
                last_activity_date=today,
                start_date=today
            )
            self.db.add(streak)
        else:
            # Check if the last activity was yesterday
            yesterday = today - timedelta(days=1)
            
            if streak.last_activity_date == yesterday:
                # Increment streak
                streak.current_streak += 1
                streak.longest_streak = max(streak.longest_streak, streak.current_streak)
            elif streak.last_activity_date == today:
                # Already logged in today, no change
                return
            else:
                # Streak broken, reset
                streak.current_streak = 1
                streak.start_date = today
            
            streak.last_activity_date = today

        # Update student's streak days in progress
        progress = self.db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).first()
        
        if progress:
            progress.streak_days = streak.current_streak

    def reset_user_daily_quests(self, user_id: int, target_date: date = None):
        """
        Reset daily quests for a user on a specific date.
        This sets the status of daily quests to AVAILABLE, allowing them to complete the quests again.
        """
        if target_date is None:
            target_date = date.today()

        # Update quests to AVAILABLE where they were COMPLETED or EXPIRED
        updated_quests = self.db.query(UserDailyQuest).filter(
            and_(
                UserDailyQuest.user_id == user_id,
                cast(UserDailyQuest.quest_date, Date) == target_date,
                UserDailyQuest.status.in_([QuestStatusEnum.COMPLETED.value, QuestStatusEnum.EXPIRED.value])
            )
        ).all()

        for quest in updated_quests:
            quest.status = QuestStatusEnum.AVAILABLE.value
            quest.last_updated = datetime.utcnow()
        
        if updated_quests:
            self.db.commit()
            logger.info(f"Reset {len(updated_quests)} daily quests for user {user_id} on {target_date}")

    def cleanup_expired_quests(self):
        """Cleanup expired quests - remove or archive them as necessary."""
        now = datetime.utcnow()
        
        # Example: Archive expired quests (set a flag or move to an archive table)
        expired_quests = self.db.query(UserDailyQuest).filter(
            and_(
                UserDailyQuest.status == QuestStatusEnum.EXPIRED.value,
                UserDailyQuest.expires_at < now
            )
        ).all()
        
        for quest in expired_quests:
            # Perform archive operation, e.g., move to an archive table
            pass  # Implement archive logic here

        # Optionally, remove expired quests that are no longer needed
        # self.db.query(UserDailyQuest).filter(
        #     UserDailyQuest.status == QuestStatusEnum.EXPIRED.value
        # ).delete(synchronize_session=False)

    def _check_badges_after_quest_completion(self, user_id: int):
        """
        Check for badge achievements after a quest completion.
        This integrates badge checking into the quest completion flow.
        """
        try:
            badge_service = BadgeService(self.db)
            awarded_badges = badge_service.check_all_badges_for_user(user_id)
            
            if awarded_badges:
                logger.info(f"User {user_id} earned {len(awarded_badges)} badges after quest completion")
                for badge_award in awarded_badges:
                    logger.info(f"Awarded badge '{badge_award['badge'].name}' to user {user_id}")
            
            return awarded_badges
        except Exception as e:
            logger.error(f"Error checking badges for user {user_id}: {e}")
            return []