"use client";

import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { useGlobalXPReward } from "@/contexts/xp-reward-context";

export function useDailyLoginQuest() {
  const { user } = useCurrentUser();
  const { showXPReward, createRewardData, isOnboardingInProgress } =
    useGlobalXPReward();
  const hasCompletedToday = useRef<string | null>(null);

  useEffect(() => {
    const completeLoginQuest = async () => {
      if (!user?.id) return;

      // Wait for onboarding state to be determined before proceeding
      if (isOnboardingInProgress) {
        console.log("Daily login quest waiting for onboarding to complete...");
        return;
      }

      const today = new Date().toDateString();

      // Prevent multiple completion attempts on the same day
      if (hasCompletedToday.current === today) return;

      // console.log(
      //   "Starting daily login quest completion for user:",
      //   user.username
      // );

      try {
        // Ensure quest templates are seeded (this is idempotent)
        await apiClient.seedDailyQuests();

        // Complete the daily login quest
        const result = await apiClient.completeDailyQuest(
          user.id,
          "daily_login"
        );
        if (result.success) {
          // Fetch current user progress to show accurate XP reward
          try {
            const progress = await apiClient.fetchStudentProgress(user.id);
            const rewardData = createRewardData(
              result.xp_awarded,
              "Daily Login Completed! 🎉",
              progress.total_exp
            );
            showXPReward(rewardData);
          } catch (error) {
            console.error("Failed to fetch progress for XP reward:", error);
            // Fallback to simple toast if progress fetch fails
            toast({
              title: "Welcome back! 🎉",
              description: `Daily login completed! You earned ${result.xp_awarded} XP`,
            });
          }
        }

        hasCompletedToday.current = today;
      } catch (error) {
        console.error("Failed to complete daily login quest:", error);
        // Don't show error toast for login quest completion failure
        // as it might be already completed or other non-critical issues
      }
    };

    // Small delay to ensure user data is fully loaded
    const timer = setTimeout(completeLoginQuest, 2000);

    return () => clearTimeout(timer);
  }, [user?.id, isOnboardingInProgress]); // Added isOnboardingInProgress to dependencies

  return null;
}
