export interface Badge {
  badge_id: number;
  name: string;
  description?: string;
  badge_type: string;
  image_url?: string;
  criteria: BadgeCriteria;
  exp_value: number;
  created_at: string;
  created_by?: number;
  is_active: boolean;
}

export interface BadgeCriteria {
  type: BadgeCriteriaType;
  target: number;
  comparison?:
    | "greater_than"
    | "greater_than_or_equal"
    | "less_than"
    | "less_than_or_equal"
    | "equal";
  count?: number;
  course_id?: number;
  description?: string;
  // Presentation hints for the in-app SVG medallion.
  icon?: string;
  color?: string;
  shape?: "circle" | "shield" | "banner";
  streak_type?: string;
}

export type BadgeCriteriaType =
  | "quiz_completion"
  | "quiz_score"
  | "quest_completion"
  | "quest_completion_time"
  | "total_exp"
  | "level_reached"
  | "pet_level"
  | "streak_days"
  | "perfect_scores"
  | "daily_quest_streak"
  | "xp_earned"
  | "grade_average"
  | "assignment_submission"
  | "participation"
  | "manual"
  | "custom";

export interface UserBadge {
  user_badge_id: number;
  user_id: number;
  badge_id: number;
  awarded_at: string;
  awarded_by?: number;
  course_id?: number;
  badge: Badge;
}

export interface UserBadgeProgress {
  badge: Badge;
  earned: boolean;
  awarded_at?: string;
  user_badge_id?: number;
  course_id?: number;
  awarded_by?: number;
  progress: any;
  progress_percentage: number;
  progress_target: number;
}

export interface BadgeSystemResponse {
  earned_badges: UserBadgeProgress[];
  available_badges: UserBadgeProgress[];
  stats: {
    total_badges: number;
    earned_count: number;
    available_count: number;
    completion_percentage: number;
  };
}

export interface BadgeCreate {
  name: string;
  description?: string;
  badge_type: string;
  image_url?: string;
  criteria: BadgeCriteria;
  exp_value?: number;
  is_active?: boolean;
}

export interface BadgeUpdate {
  name?: string;
  description?: string;
  badge_type?: string;
  image_url?: string;
  criteria?: BadgeCriteria;
  exp_value?: number;
  is_active?: boolean;
}

export interface BadgeAwardResult {
  message: string;
  badge: Badge;
  exp_bonus: number;
}

export interface NewlyAwardedBadge {
  name: string;
  exp_bonus: number;
}

export interface BadgeCheckResult {
  message: string;
  newly_awarded: number;
  badges: NewlyAwardedBadge[];
}

// Badge type constants
export const BADGE_TYPES = {
  QUEST_COMPLETION: "quest_completion",
  STREAK: "streak",
  LEVEL: "level",
  XP: "xp",
  SOCIAL: "social",
  DAILY_QUEST: "daily_quest",
  QUIZ: "quiz",
  SPEED: "speed",
  LEADERBOARD: "leaderboard",
  TIME: "time",
} as const;

export type BadgeType = (typeof BADGE_TYPES)[keyof typeof BADGE_TYPES];

// Helper function to get badge icon based on type
export const getBadgeIcon = (badgeType: string): string => {
  switch (badgeType) {
    case BADGE_TYPES.QUEST_COMPLETION:
      return "🏴";
    case BADGE_TYPES.STREAK:
      return "🔥";
    case BADGE_TYPES.LEVEL:
      return "👑";
    case BADGE_TYPES.XP:
      return "⚡";
    case BADGE_TYPES.SOCIAL:
      return "👥";
    case BADGE_TYPES.DAILY_QUEST:
      return "🎯";
    case BADGE_TYPES.QUIZ:
      return "⭐";
    case BADGE_TYPES.SPEED:
      return "⏱️";
    case BADGE_TYPES.LEADERBOARD:
      return "🏆";
    case BADGE_TYPES.TIME:
      return "🌅";
    default:
      return "🎖️";
  }
};
