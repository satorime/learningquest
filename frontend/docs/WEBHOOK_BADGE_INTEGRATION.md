# Badge Integration with Webhook-Based Quest Completion

## Overview

Your LearningQuest system uses **webhook-driven quest completion**, where Moodle sends events to your backend when users complete activities. I've integrated badge achievement detection directly into this webhook flow, ensuring badges are automatically checked and awarded whenever a quest is completed via webhook.

## How It Works

### 🔄 **Webhook → Quest Completion → Badge Check Flow**

1. **User completes activity in Moodle** (quiz, assignment, lesson, feedback)
2. **Moodle sends webhook** to your `/webhooks` endpoint
3. **Webhook handler processes quest completion**:
   - Updates `QuestProgress` to "completed"
   - Awards XP and updates `StudentProgress`
   - **Commits the changes**
4. **Badge checking is automatically triggered**:
   - Calls `check_badges_after_quest_completion(user_id, db)`
   - Evaluates all active badges against user's new progress
   - Awards any newly earned badges
   - Logs badge achievements

### 📍 **Integration Points Added**

I've added badge checking to these webhook handlers:

1. **Quiz Completion** (`handle_quiz_attempt_submitted`)
2. **Assignment Submission** (`handle_assign_submitted`)
3. **Lesson Completion** (quest-based lessons)
4. **Feedback Submission** (quest-based feedback)

Each integration point calls the badge checking function after the quest completion is successfully committed to the database.

## Code Changes Made

### 1. **Added Badge Service Import**

```python
from app.services.badge_service import BadgeService
```

### 2. **Created Helper Function**

```python
def check_badges_after_quest_completion(user_id: int, db: Session):
    """
    Check for badge achievements after a quest completion via webhook.
    """
    try:
        badge_service = BadgeService(db)
        awarded_badges = badge_service.check_all_badges_for_user(user_id)

        if awarded_badges:
            logger.info(f"🏆 User {user_id} earned {len(awarded_badges)} badges after webhook quest completion")
            for badge_award in awarded_badges:
                badge_info = badge_award.get('badge', {})
                logger.info(f"  🎖️ Awarded badge '{getattr(badge_info, 'name', 'Unknown')}' to user {user_id}")

        return awarded_badges
    except Exception as e:
        logger.error(f"❌ Error checking badges for user {user_id}: {e}")
        return []
```

### 3. **Integrated Badge Checking After Quest Completions**

Example from quiz completion:

```python
db.commit()

# Check for badge achievements after quest completion
check_badges_after_quest_completion(user_id, db)

# --- EXPERIENCE POINTS AND STUDENT PROGRESS ---
```

## Testing Your Integration

### Option 1: Use Moodle (Production Flow)

1. Seed badges: `POST /badges/seed`
2. Create a quest tied to a Moodle activity
3. Complete the activity in Moodle
4. Moodle sends webhook → Badge checking happens automatically
5. Check user badges: `GET /badges/user/{user_id}/progress`

### Option 2: Manual Testing Endpoint

For testing without Moodle, you can use:

```bash
POST /quests/{quest_id}/complete
{
  "user_id": 123
}
```

This simulates the webhook completion process.

### Option 3: Test Script

Use the provided test script:

```bash
python backend/test_badge_achievement.py
```

## Badge Achievement Scenarios

### Scenario 1: Quest Completion Badge

```json
{
  "type": "quest_completion",
  "target": 5
}
```

- User completes 5th quest via webhook → Badge automatically awarded

### Scenario 2: XP Milestone Badge

```json
{
  "type": "xp_earned",
  "target": 1000
}
```

- User completes quest worth 50 XP, reaching 1000 total → Badge automatically awarded

### Scenario 3: Daily Quest Streak Badge

```json
{
  "type": "daily_quest_streak",
  "target": 3
}
```

- User completes daily quests 3 days in a row → Badge automatically awarded

## Monitoring Badge Awards

### Backend Logs

When badges are awarded via webhooks, you'll see logs like:

```
🏆 User 123 earned 2 badges after webhook quest completion
  🎖️ Awarded badge 'Quest Novice' to user 123
  🎖️ Awarded badge 'XP Collector' to user 123
```

### API Responses

Quest completion responses now include badge information:

```json
{
  "success": true,
  "quest_id": 1,
  "user_id": 123,
  "exp_awarded": 50,
  "badges_earned": 2,
  "badge_details": [
    {
      "badge_id": 1,
      "name": "Quest Novice",
      "exp_bonus": 25
    }
  ]
}
```

## Frontend Integration

### Displaying Badge Notifications

When quest completion happens via webhook, the frontend can:

1. **Poll for new badges** after quest completion
2. **Use Server-Sent Events** to get real-time badge notifications
3. **Check badge status** when user returns to the app

Example frontend integration:

```typescript
// After detecting quest completion (via polling or SSE)
const response = await apiClient.getUserBadgeProgress(userId);
const newBadges = response.badges.filter((b) => b.earned && !b.previously_seen);

if (newBadges.length > 0) {
  showBadgeNotifications(newBadges);
}
```

## Advantages of This Integration

✅ **Automatic**: No manual intervention needed  
✅ **Real-time**: Badges awarded immediately after quest completion  
✅ **Consistent**: Works with your existing Moodle webhook flow  
✅ **Reliable**: Uses the same transaction as quest completion  
✅ **Scalable**: Efficient badge checking only when needed  
✅ **Logged**: Full audit trail of badge awards

## Recommendations

### For Production

1. **Keep the webhook integration** as the primary method
2. **Use the manual endpoint** only for testing or special cases
3. **Monitor badge award logs** to ensure the system is working
4. **Consider rate limiting** if badge checking becomes expensive

### For Enhanced User Experience

1. **Add real-time notifications** when badges are earned
2. **Show badge progress** in the UI to motivate users
3. **Celebrate badge achievements** with animations/sounds
4. **Create badge leaderboards** to encourage competition

Your badge system is now fully integrated with your webhook-based quest completion flow! 🏆
