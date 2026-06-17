import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { Badge, UserBadge } from "@/types/badges";
import { toast } from "@/hooks/use-toast";

export interface UserBadgeProgress {
  badge: Badge;
  earned: boolean;
  earnedAt?: string;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
}

export interface BadgeCollectionReturn {
  allBadges: Badge[];
  userBadges: UserBadge[];
  badgeProgress: UserBadgeProgress[];
  earnedBadges: UserBadgeProgress[];
  availableBadges: UserBadgeProgress[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  seedBadges: () => Promise<void>;
}

export function useBadgeCollection(userId?: number): BadgeCollectionReturn {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [badgeProgress, setBadgeProgress] = useState<UserBadgeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchBadgeData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all available badges with improved error handling
      let badges: Badge[] = [];
      try {
        badges = await apiClient.getAllBadges(true);
        setAllBadges(badges);
      } catch (badgeError) {
        setAllBadges([]);

        const errorMsg =
          badgeError instanceof Error && badgeError.message.includes("timeout")
            ? "Badge service is temporarily unavailable. Please try again later."
            : "Failed to load badges. Some features may be limited.";
        setError(errorMsg);

        // Still try to process user data if available
        if (userId) {
          try {
            const userEarnedBadges = await apiClient.getUserBadges(userId);
            setUserBadges(userEarnedBadges);
            const userOnlyProgress: UserBadgeProgress[] = userEarnedBadges.map(
              (userBadge) => ({
                badge: {
                  badge_id: userBadge.badge_id,
                  name: "Badge",
                  description: "Badge description unavailable",
                  badge_type: "achievement",
                  image_url: "/badges/default-badge.png",
                  criteria: {
                    type: "quest_completion" as const,
                    target: 1,
                    description: "Badge criteria unavailable",
                  },
                  exp_value: 0,
                  created_at: "",
                  created_by: undefined,
                  is_active: true,
                },
                earned: true,
                earnedAt: userBadge.awarded_at,
                progress: { current: 1, target: 1, percentage: 100 },
              })
            );
            setBadgeProgress(userOnlyProgress);
          } catch (userBadgeError) {
            setBadgeProgress([]);
          }
        }
        return;
      }

      if (userId) {
        // The earned-badges list and the progress summary are independent, so
        // fetch them together instead of one after the other (one round-trip
        // instead of two). allSettled keeps the existing graceful fallbacks.
        const [userRes, progressRes] = await Promise.allSettled([
          apiClient.getUserBadges(userId),
          apiClient.getUserBadgeProgress(userId),
        ]);

        const userEarnedBadges =
          userRes.status === "fulfilled" ? userRes.value : [];
        if (userRes.status === "fulfilled") setUserBadges(userEarnedBadges);

        if (progressRes.status === "fulfilled") {
          const progressData = progressRes.value;

          const earnedBadgesList: UserBadgeProgress[] = (
            progressData.earned_badges || []
          ).map((item: any) => ({
            badge: item.badge,
            earned: true,
            earnedAt: item.awarded_at,
            progress: {
              current: item.progress || item.progress_target || 1,
              target: item.progress_target || item.badge?.criteria?.target || 1,
              percentage: 100,
            },
          }));
          const availableBadgesList: UserBadgeProgress[] = (
            progressData.available_badges || []
          ).map((item: any) => ({
            badge: item.badge,
            earned: false,
            earnedAt: undefined,
            progress: {
              current: item.progress || 0,
              target: item.progress_target || item.badge?.criteria?.target || 1,
              percentage: item.progress_percentage || 0,
            },
          }));

          setBadgeProgress([...earnedBadgesList, ...availableBadgesList]);
        } else {
          // Progress endpoint failed → basic progress from the earned list.
          const basicProgress: UserBadgeProgress[] = badges.map((badge) => {
            const earnedBadge = userEarnedBadges.find(
              (ub) => ub.badge_id === badge.badge_id
            );
            return {
              badge,
              earned: !!earnedBadge,
              earnedAt: earnedBadge?.awarded_at,
              progress: earnedBadge
                ? { current: 1, target: 1, percentage: 100 }
                : { current: 0, target: 1, percentage: 0 },
            };
          });
          setBadgeProgress(basicProgress);
        }
      } else {
        // No user provided, just show all badges as not earned
        const basicProgress: UserBadgeProgress[] = badges.map((badge) => ({
          badge,
          earned: false,
          progress: { current: 0, target: 1, percentage: 0 },
        }));
        setBadgeProgress(basicProgress);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch badge data";
      setError(errorMessage);

      setAllBadges([]);
      setUserBadges([]);
      setBadgeProgress([]);
    } finally {
      setLoading(false);
    }
  };

  const seedBadges = async () => {
    try {
      setLoading(true);
      await apiClient.seedBadges();
      toast({
        title: "Success",
        description: "Predefined badges have been seeded successfully!",
      });
      await fetchBadgeData();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to seed badges";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const earnedBadges = badgeProgress.filter((bp) => bp.earned);
  const availableBadges = badgeProgress.filter((bp) => !bp.earned);

  useEffect(() => {
    fetchBadgeData();
  }, [userId]);

  return {
    allBadges,
    userBadges,
    badgeProgress,
    earnedBadges,
    availableBadges,
    loading,
    error,
    refetch: fetchBadgeData,
    seedBadges,
  };
}
