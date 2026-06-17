"""Seed the predefined (system) badges.

Every badge's ``criteria`` carries presentation hints used by the frontend to
draw a unique in-app SVG medallion (no image files):
    - ``icon``  : symbol name (mapped to a Lucide glyph client-side)
    - ``color`` : palette key (light->dark progression across tiers)
    - ``shape`` : "circle" | "shield" | "banner"

Seeding is additive and idempotent: badges are inserted by name only if they
don't already exist, so new tiers land on existing databases without wiping or
duplicating anything.
"""
from sqlalchemy.orm import Session
from app.models.badge import Badge


# Login-streak tiers (auto-award via streak_days / login UserStreak).
_STREAK_TIERS = [
    (3, "Streak Starter", "amber", "circle", 30),
    (7, "Week Warrior", "orange", "circle", 60),
    (14, "Fortnight Flame", "red", "circle", 100),
    (30, "Monthly Devotee", "rose", "shield", 200),
    (60, "Relentless", "violet", "shield", 350),
    (100, "Centurion", "indigo", "banner", 600),
]

# Pet-level milestones, every 5 levels (auto-award via pet_level).
_PET_LEVEL_TIERS = [
    (5, "emerald", "circle", 40),
    (10, "teal", "circle", 70),
    (15, "sky", "circle", 110),
    (20, "blue", "shield", 160),
    (25, "indigo", "shield", 220),
    (30, "violet", "shield", 300),
    (35, "purple", "shield", 380),
    (40, "fuchsia", "banner", 480),
    (45, "pink", "banner", 600),
    (50, "gold", "banner", 800),
]


def _build_badges() -> list[dict]:
    badges: list[dict] = []

    # --- General progression badges (criteria types the engine implements) ---
    badges.extend([
        {
            "name": "First Quest",
            "description": "Complete your very first quest",
            "badge_type": "achievement",
            "criteria": {"type": "quest_completion", "target": 1,
                         "icon": "flag", "color": "emerald", "shape": "circle",
                         "description": "Complete 1 quest"},
            "exp_value": 50,
        },
        {
            "name": "Knowledge Seeker",
            "description": "Complete 10 quests",
            "badge_type": "achievement",
            "criteria": {"type": "quest_completion", "target": 10,
                         "icon": "book-open", "color": "blue", "shape": "shield",
                         "description": "Complete 10 quests"},
            "exp_value": 200,
        },
        {
            "name": "Quest Champion",
            "description": "Complete 25 quests",
            "badge_type": "achievement",
            "criteria": {"type": "quest_completion", "target": 25,
                         "icon": "trophy", "color": "indigo", "shape": "banner",
                         "description": "Complete 25 quests"},
            "exp_value": 400,
        },
        {
            "name": "XP Master",
            "description": "Earn 1000 total experience points",
            "badge_type": "experience",
            "criteria": {"type": "total_exp", "target": 1000,
                         "icon": "zap", "color": "violet", "shape": "shield",
                         "description": "Earn 1000 total XP"},
            "exp_value": 150,
        },
        {
            "name": "XP Legend",
            "description": "Earn 5000 total experience points",
            "badge_type": "experience",
            "criteria": {"type": "total_exp", "target": 5000,
                         "icon": "sparkles", "color": "gold", "shape": "banner",
                         "description": "Earn 5000 total XP"},
            "exp_value": 500,
        },
        {
            "name": "Perfect Week",
            "description": "Complete daily quests for 7 days",
            "badge_type": "streak",
            "criteria": {"type": "daily_quest_streak", "target": 7,
                         "icon": "target", "color": "rose", "shape": "shield",
                         "description": "Complete daily quests for 7 consecutive days"},
            "exp_value": 300,
        },
    ])

    # --- Login-streak tiers ---
    for days, name, color, shape, exp in _STREAK_TIERS:
        badges.append({
            "name": name,
            "description": f"Log in {days} days in a row",
            "badge_type": "streak",
            "criteria": {"type": "streak_days", "target": days,
                         "streak_type": "login", "icon": "flame",
                         "color": color, "shape": shape,
                         "description": f"Maintain a {days}-day login streak"},
            "exp_value": exp,
        })

    # --- Pet-level milestone tiers ---
    for level, color, shape, exp in _PET_LEVEL_TIERS:
        badges.append({
            "name": f"Pet Level {level}",
            "description": f"Grow your pet to level {level}",
            "badge_type": "level",
            "criteria": {"type": "pet_level", "target": level,
                         "icon": "crown", "color": color, "shape": shape,
                         "description": f"Reach pet level {level}"},
            "exp_value": exp,
        })

    return badges


def seed_badges(db: Session):
    """Insert any missing system badges (idempotent, additive)."""
    created_count = 0
    for badge_data in _build_badges():
        existing = db.query(Badge).filter(Badge.name == badge_data["name"]).first()
        if existing:
            continue
        db.add(Badge(
            name=badge_data["name"],
            description=badge_data["description"],
            badge_type=badge_data["badge_type"],
            criteria=badge_data["criteria"],
            exp_value=badge_data["exp_value"],
            created_by=None,  # system badge
            is_active=True,
        ))
        created_count += 1

    try:
        db.commit()
        if created_count:
            print(f"Seeded {created_count} new badge(s).")
    except Exception as e:
        db.rollback()
        print(f"Error seeding badges: {e}")
        raise
