"use client";

/**
 * BadgeArt — a unique, in-app SVG "medallion" for a badge. No image files: each
 * badge is drawn as a gradient shape (circle / shield / banner) with a stitched
 * inner ring, a glossy highlight, and a Lucide symbol in the center. Shape +
 * color + symbol come from the badge's `criteria` (icon/color/shape).
 */
import * as React from "react";
import {
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  Crown,
  Flag,
  Flame,
  Gift,
  GraduationCap,
  Heart,
  Lightbulb,
  Lock,
  Medal,
  Rocket,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type BadgeShape = "circle" | "shield" | "banner";

type Palette = { light: string; dark: string; ring: string };

export const BADGE_COLORS: Record<string, Palette> = {
  emerald: { light: "#34d399", dark: "#059669", ring: "#047857" },
  teal: { light: "#2dd4bf", dark: "#0d9488", ring: "#0f766e" },
  cyan: { light: "#22d3ee", dark: "#0891b2", ring: "#0e7490" },
  sky: { light: "#38bdf8", dark: "#0284c7", ring: "#0369a1" },
  blue: { light: "#60a5fa", dark: "#2563eb", ring: "#1d4ed8" },
  indigo: { light: "#818cf8", dark: "#4f46e5", ring: "#4338ca" },
  violet: { light: "#a78bfa", dark: "#7c3aed", ring: "#6d28d9" },
  purple: { light: "#c084fc", dark: "#9333ea", ring: "#7e22ce" },
  fuchsia: { light: "#e879f9", dark: "#c026d3", ring: "#a21caf" },
  pink: { light: "#f472b6", dark: "#db2777", ring: "#be185d" },
  rose: { light: "#fb7185", dark: "#e11d48", ring: "#be123c" },
  red: { light: "#f87171", dark: "#dc2626", ring: "#b91c1c" },
  orange: { light: "#fb923c", dark: "#ea580c", ring: "#c2410c" },
  amber: { light: "#fbbf24", dark: "#d97706", ring: "#b45309" },
  gold: { light: "#fcd34d", dark: "#f59e0b", ring: "#b45309" },
  slate: { light: "#94a3b8", dark: "#475569", ring: "#334155" },
};

const LOCKED: Palette = { light: "#cbd5e1", dark: "#94a3b8", ring: "#94a3b8" };

export const BADGE_ICONS: Record<string, LucideIcon> = {
  award: Award,
  trophy: Trophy,
  crown: Crown,
  star: Star,
  medal: Medal,
  flame: Flame,
  zap: Zap,
  "book-open": BookOpen,
  target: Target,
  heart: Heart,
  gift: Gift,
  flag: Flag,
  sparkles: Sparkles,
  users: Users,
  clock: Clock,
  check: CheckCircle2,
  shield: ShieldCheck,
  rocket: Rocket,
  brain: Brain,
  graduation: GraduationCap,
  "thumbs-up": ThumbsUp,
  smile: Smile,
  lightbulb: Lightbulb,
};

/** Options for the teacher picker UI. */
export const BADGE_ICON_OPTIONS = Object.keys(BADGE_ICONS);
export const BADGE_COLOR_OPTIONS = Object.keys(BADGE_COLORS);
export const BADGE_SHAPE_OPTIONS: BadgeShape[] = ["circle", "shield", "banner"];

const SHAPE_PATHS: Record<Exclude<BadgeShape, "circle">, string> = {
  // Heraldic shield.
  shield: "M50 7 L85 19 V47 C85 69 69 85 50 93 C31 85 15 69 15 47 V19 Z",
  // Pennant / banner with a pointed bottom.
  banner: "M25 12 H75 V69 L50 90 L25 69 Z",
};

interface BadgeArtProps {
  iconName?: string;
  color?: string;
  shape?: BadgeShape;
  earned?: boolean;
  size?: number;
  className?: string;
}

export function BadgeArt({
  iconName = "award",
  color = "amber",
  shape = "circle",
  earned = true,
  size = 72,
  className,
}: BadgeArtProps) {
  const pal = earned ? BADGE_COLORS[color] ?? BADGE_COLORS.amber : LOCKED;
  const Icon = earned ? BADGE_ICONS[iconName] ?? Award : Lock;
  const uid = React.useId().replace(/:/g, "");
  const gradId = `bg-${uid}`;
  const glossId = `gl-${uid}`;

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative", lineHeight: 0 }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          display: "block",
          filter: earned ? "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" : "none",
          opacity: earned ? 1 : 0.75,
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.light} />
            <stop offset="100%" stopColor={pal.dark} />
          </linearGradient>
          <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {shape === "circle" ? (
          <>
            <circle cx="50" cy="50" r="46" fill={pal.ring} />
            <circle cx="50" cy="50" r="43" fill={`url(#${gradId})`} />
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.5"
              strokeWidth="1.6"
              strokeDasharray="2 4"
            />
            <ellipse cx="50" cy="36" rx="34" ry="22" fill={`url(#${glossId})`} />
          </>
        ) : (
          <>
            <path
              d={SHAPE_PATHS[shape]}
              fill={pal.ring}
              transform="translate(0,1.5)"
            />
            <path d={SHAPE_PATHS[shape]} fill={`url(#${gradId})`} />
            <path
              d={SHAPE_PATHS[shape]}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.5"
              strokeWidth="1.6"
              strokeDasharray="2 4"
              transform="scale(0.82) translate(11,9)"
            />
            <ellipse cx="50" cy="34" rx="28" ry="18" fill={`url(#${glossId})`} />
          </>
        )}
      </svg>

      {/* Centered symbol */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: shape === "banner" ? "center" : "center",
          paddingBottom: shape === "banner" ? size * 0.12 : 0,
        }}
      >
        <Icon
          color="#ffffff"
          strokeWidth={2.1}
          style={{ width: size * 0.4, height: size * 0.4, opacity: earned ? 1 : 0.85 }}
        />
      </div>
    </div>
  );
}

/** Pull presentation hints off a badge's criteria with sensible fallbacks. */
export function badgeArtPropsFromCriteria(criteria: any): {
  iconName: string;
  color: string;
  shape: BadgeShape;
} {
  const c = criteria || {};
  const shape: BadgeShape =
    c.shape === "shield" || c.shape === "banner" || c.shape === "circle"
      ? c.shape
      : "circle";
  return {
    iconName: typeof c.icon === "string" ? c.icon : "award",
    color: typeof c.color === "string" ? c.color : "amber",
    shape,
  };
}
