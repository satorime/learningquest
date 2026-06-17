// Leveling system utility functions for LearningQuest

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpProgressPercentage: number;
  title: string;
  color: string;
  gradient: string;
  glowColor: string;
}

export interface LevelTheme {
  title: string;
  color: string;
  gradient: string;
  glowColor: string;
  icon: string;
}

// Level themes with visual styling
export const LEVEL_THEMES: Record<number, LevelTheme> = {
  1: {
    title: "Novice",
    color: "text-gray-600",
    gradient: "from-gray-400 to-gray-500",
    glowColor: "shadow-gray-400/50",
    icon: "🌱",
  },
  5: {
    title: "Apprentice",
    color: "text-green-600",
    gradient: "from-green-400 to-green-500",
    glowColor: "shadow-green-400/50",
    icon: "🌿",
  },
  10: {
    title: "Scholar",
    color: "text-blue-600",
    gradient: "from-blue-400 to-blue-500",
    glowColor: "shadow-blue-400/50",
    icon: "📚",
  },
  15: {
    title: "Expert",
    color: "text-purple-600",
    gradient: "from-purple-400 to-purple-500",
    glowColor: "shadow-purple-400/50",
    icon: "🔮",
  },
  20: {
    title: "Master",
    color: "text-amber-600",
    gradient: "from-amber-400 to-amber-500",
    glowColor: "shadow-amber-400/50",
    icon: "⭐",
  },
  25: {
    title: "Grandmaster",
    color: "text-orange-600",
    gradient: "from-orange-400 to-orange-500",
    glowColor: "shadow-orange-400/50",
    icon: "🏆",
  },
  30: {
    title: "Legend",
    color: "text-red-600",
    gradient: "from-red-400 to-red-500",
    glowColor: "shadow-red-400/50",
    icon: "🔥",
  },
  40: {
    title: "Mythic",
    color: "text-pink-600",
    gradient: "from-pink-400 to-pink-500",
    glowColor: "shadow-pink-400/50",
    icon: "💎",
  },
  50: {
    title: "Ascended",
    color: "text-cyan-600",
    gradient: "from-cyan-400 to-cyan-500",
    glowColor: "shadow-cyan-400/50",
    icon: "✨",
  },
  75: {
    title: "Transcendent",
    color: "text-indigo-600",
    gradient: "from-indigo-400 to-indigo-500",
    glowColor: "shadow-indigo-400/50",
    icon: "🌟",
  },
  100: {
    title: "Omniscient",
    color: "text-violet-600",
    gradient: "from-violet-400 to-violet-500",
    glowColor: "shadow-violet-400/50",
    icon: "🎭",
  },
};

/**
 * Calculate XP required for a specific level using exponential curve
 * Formula: XP = base * (level^exponent) + (level * linear_factor)
 */
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;

  const base = 100;
  const exponent = 1.5;
  const linearFactor = 50;

  return Math.floor(
    base * Math.pow(level - 1, exponent) + (level - 1) * linearFactor
  );
}

/**
 * Calculate the total XP required to reach a specific level
 */
export function getTotalXPForLevel(level: number): number {
  let totalXP = 0;
  for (let i = 2; i <= level; i++) {
    totalXP += getXPForLevel(i);
  }
  return totalXP;
}

/**
 * Calculate current level from total XP
 */
export function calculateLevelFromXP(totalXP: number): number {
  if (totalXP < 0) return 1;

  let level = 1;
  let xpAccumulated = 0;

  while (xpAccumulated <= totalXP) {
    level++;
    const xpForNextLevel = getXPForLevel(level);
    if (xpAccumulated + xpForNextLevel > totalXP) {
      level--;
      break;
    }
    xpAccumulated += xpForNextLevel;
  }

  return Math.max(1, level);
}

/**
 * Get level theme based on current level
 */
export function getLevelTheme(level: number): LevelTheme {
  // Find the highest level theme that the user has reached
  const availableThemes = Object.keys(LEVEL_THEMES)
    .map(Number)
    .sort((a, b) => b - a); // Sort descending

  for (const themeLevel of availableThemes) {
    if (level >= themeLevel) {
      return LEVEL_THEMES[themeLevel];
    }
  }

  return LEVEL_THEMES[1]; // Default to novice
}

/**
 * Get comprehensive level information
 */
export function getLevelInfo(totalXP: number): LevelInfo {
  const level = calculateLevelFromXP(totalXP);
  const theme = getLevelTheme(level);

  // Calculate XP for current and next level
  const xpForCurrentLevel = getTotalXPForLevel(level);
  const xpForNextLevel = getTotalXPForLevel(level + 1);

  // Calculate progress within current level
  const currentXP = totalXP - xpForCurrentLevel;
  const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
  const xpProgress = Math.max(0, currentXP);
  const xpProgressPercentage =
    xpNeededForNext > 0 ? (xpProgress / xpNeededForNext) * 100 : 0;

  return {
    level,
    currentXP: totalXP,
    xpForCurrentLevel,
    xpForNextLevel,
    xpProgress,
    xpProgressPercentage: Math.min(100, xpProgressPercentage),
    title: theme.title,
    color: theme.color,
    gradient: theme.gradient,
    glowColor: theme.glowColor,
  };
}

/**
 * Check if a level up occurred between two XP values
 */
export function checkLevelUp(
  oldXP: number,
  newXP: number
): {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  levelsGained: number;
} {
  const oldLevel = calculateLevelFromXP(oldXP);
  const newLevel = calculateLevelFromXP(newXP);
  const leveledUp = newLevel > oldLevel;
  const levelsGained = newLevel - oldLevel;

  return {
    leveledUp,
    oldLevel,
    newLevel,
    levelsGained,
  };
}

/**
 * Get XP milestones for visual progress indicators
 */
export function getXPMilestones(level: number): number[] {
  const xpForCurrent = getTotalXPForLevel(level);
  const xpForNext = getTotalXPForLevel(level + 1);
  const xpRange = xpForNext - xpForCurrent;

  const milestones = [];
  for (let i = 0; i <= 4; i++) {
    milestones.push(xpForCurrent + (xpRange * i) / 4);
  }

  return milestones;
}

/**
 * Format XP number for display
 */
export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  } else if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
}

/**
 * Get next level milestone
 */
export function getNextLevelMilestone(currentLevel: number): number | null {
  const milestones = Object.keys(LEVEL_THEMES)
    .map(Number)
    .sort((a, b) => a - b);
  return milestones.find((milestone) => milestone > currentLevel) || null;
}

/**
 * Calculate estimated time to next level based on average daily XP
 */
export function estimateTimeToNextLevel(
  currentXP: number,
  averageDailyXP: number
): { days: number; weeks: number } | null {
  if (averageDailyXP <= 0) return null;

  const levelInfo = getLevelInfo(currentXP);
  const xpNeeded = levelInfo.xpForNextLevel - currentXP;
  const days = Math.ceil(xpNeeded / averageDailyXP);
  const weeks = Math.ceil(days / 7);

  return { days, weeks };
}
