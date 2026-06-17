# How Badge Achievement Detection Works in LearningQuest

## Overview

Your LearningQuest badge system uses an **event-driven architecture** where badges are automatically checked and awarded when users perform certain actions. The system doesn't continuously monitor for achievements - instead, it triggers badge checks at specific moments when a user's progress changes.

## When Badge Detection Happens

### 1. **Quest Completion Events**

- **Daily Quest Completion**: When a user completes any daily quest (login, feed pet, earn XP)
- **Regular Quest Completion**: When a user completes a regular quest through the `/quests/{quest_id}/complete` endpoint
- **Moodle Integration**: When quest completion is synchronized from Moodle (if integrated)

### 2. **Manual Badge Checking**

- **API Endpoint**: `/badges/check-user/{user_id}` - Check all badges for a specific user
- **Dev Dashboard**: Use the Badge Checker Panel to manually trigger badge checks
- **Admin Tools**: Bulk checking of badges for all users

### 3. **Event-Based Triggers** (Future Integration Points)

- **User Login**: Check login streak badges
- **XP Earning**: Check XP milestone badges
- **Assignment Submission**: Check assignment-related badges
- **Grade Updates**: Check grade achievement badges

## How the Detection Process Works

### Step 1: Trigger Event

```python
# Example: User completes a quest
result = service.complete_daily_login_quest(user_id)

# This automatically calls:
self._check_badges_after_quest_completion(user_id)
```

### Step 2: Badge Criteria Evaluation

The system checks all active badges against the user's current progress:

```python
def _check_badge_criteria(self, user_id: int, badge: Badge) -> bool:
    criteria = badge.criteria
    criteria_type = criteria.get("type", "")
    target = criteria.get("target", 1)

    if criteria_type == "quest_completion":
        # Count completed quests
        completed_count = db.query(QuestProgress).filter(
            QuestProgress.user_id == user_id,
            QuestProgress.status == "completed"
        ).count()
        return completed_count >= target

    elif criteria_type == "xp_earned":
        # Check total XP
        student_progress = db.query(StudentProgress).filter(
            StudentProgress.user_id == user_id
        ).first()
        return student_progress.total_exp >= target if student_progress else False

    # ... other criteria types
```

### Step 3: Badge Award Process

```python
def award_badge(self, user_id: int, badge_id: int) -> dict:
    # Check if user already has this badge
    existing = db.query(UserBadge).filter(
        UserBadge.user_id == user_id,
        UserBadge.badge_id == badge_id
    ).first()

    if existing:
        return None  # Already awarded

    # Create the badge award
    user_badge = UserBadge(
        user_id=user_id,
        badge_id=badge_id,
        awarded_at=datetime.utcnow()
    )
    db.add(user_badge)
    db.commit()

    return {"badge": badge, "user_badge": user_badge}
```

## Supported Badge Criteria Types

### Currently Implemented:

1. **`quest_completion`**: Number of quests completed

   ```json
   { "type": "quest_completion", "target": 5 }
   ```

2. **`xp_earned`**: Total XP accumulated

   ```json
   { "type": "xp_earned", "target": 1000 }
   ```

3. **`streak_days`**: Login streak maintenance

   ```json
   { "type": "streak_days", "streak_type": "login", "target": 7 }
   ```

4. **`daily_quest_streak`**: Consecutive daily quest completions
   ```json
   { "type": "daily_quest_streak", "target": 3 }
   ```

### Planned for Future:

- `grade_average`: Maintaining grade thresholds
- `assignment_submission`: On-time assignment submissions
- `participation`: Activity participation metrics

## Testing Badge Achievement

### Using the API (Postman/curl):

1. **Complete a quest to trigger badge checking:**

   ```bash
   POST /quests/1/complete
   {
     "user_id": 123
   }
   ```

2. **Manually check badges for a user:**

   ```bash
   POST /badges/check-user/123
   ```

3. **Check user's badge progress:**
   ```bash
   GET /badges/user/123/progress
   ```

### Using the Frontend:

1. **Dev Dashboard**: Navigate to `/dev-dashboard` and use the Badge Checker Panel
2. **Student View**: Check the badge collection at `/student/quests`
3. **Real-time Updates**: Badges appear immediately after earning them

## Integration Points

### In Your Application Flow:

1. **After Quest Completion**:

   ```python
   # In quest completion logic
   badge_service = BadgeService(db)
   awarded_badges = badge_service.check_all_badges_for_user(user_id)

   # Show notifications to user
   if awarded_badges:
       for badge in awarded_badges:
           show_notification(f"Badge earned: {badge['badge'].name}")
   ```

2. **During Login Process**:

   ```python
   # In login handler
   badge_service = BadgeService(db)
   login_badges = badge_service.check_specific_badge_type(user_id, "streak_days")
   ```

3. **Periodic Batch Processing** (Optional):
   ```python
   # Run periodically to catch any missed badges
   def check_all_users_badges():
       users = db.query(User).all()
       for user in users:
           badge_service.check_all_badges_for_user(user.id)
   ```

## Key Benefits of This Approach

1. **Performance**: Badges are only checked when relevant events occur
2. **Real-time**: Users see badge awards immediately after earning them
3. **Reliable**: No badges are missed due to the event-driven nature
4. **Scalable**: System performance doesn't degrade as user base grows
5. **Flexible**: Easy to add new badge criteria and trigger points

## Common Integration Patterns

### Pattern 1: Quest Completion Flow

```
User completes quest → Quest service updates progress → Badge service checks criteria → Award badges → Notify user
```

### Pattern 2: Login Flow

```
User logs in → Update login streak → Check streak badges → Award if earned → Show in UI
```

### Pattern 3: XP Earning Flow

```
User earns XP → Update student progress → Check XP milestone badges → Award if earned → Update leaderboard
```

This event-driven system ensures that your users receive their badges at the perfect moment - right when they achieve something noteworthy!
