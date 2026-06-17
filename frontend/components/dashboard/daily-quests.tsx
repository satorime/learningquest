"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Trophy, Zap, Heart, Target } from "lucide-react";
import {
  apiClient,
  type DailyQuestSummary,
  type UserDailyQuest,
} from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useGlobalXPReward } from "@/contexts/xp-reward-context";
import toast from "react-hot-toast";

export function DailyQuests() {
  const { user } = useCurrentUser();
  const { showXPReward, createRewardData } = useGlobalXPReward();
  const [questSummary, setQuestSummary] = useState<DailyQuestSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [completingQuest, setCompletingQuest] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyQuests = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const summary = await apiClient.getDailyQuestSummary(user.id);
        setQuestSummary(summary);
      } catch (error) {
        console.error("Failed to fetch daily quests:", error);
        toast.error("Failed to load daily quests");
      } finally {
        setLoading(false);
      }
    };

    fetchDailyQuests();
  }, [user?.id]);

  const handleCompleteQuest = async (quest: UserDailyQuest) => {
    if (!user?.id || quest.status === "completed") return;

    try {
      setCompletingQuest(quest.daily_quest.quest_type);
      const result = await apiClient.completeDailyQuest(
        user.id,
        quest.daily_quest.quest_type
      );
      if (result.success) {
        // Show XP reward popup with current progress
        try {
          const progress = await apiClient.fetchStudentProgress(user.id);
          const questTitle = `${quest.daily_quest.title} Completed! 🎉`;
          const rewardData = createRewardData(
            result.xp_awarded,
            questTitle,
            progress.total_exp
          );
          showXPReward(rewardData);
        } catch (error) {
          console.error("Failed to fetch progress for XP reward:", error);
          // Fallback to toast if progress fetch fails
          toast.success(
            `Quest Completed! 🎉 You earned ${result.xp_awarded} XP!`
          );
        }

        // Refresh quest summary
        const updatedSummary = await apiClient.getDailyQuestSummary(user.id);
        setQuestSummary(updatedSummary);
      } else {
        toast(`Quest Already Completed: ${result.message}`);
      }
    } catch (error) {
      console.error("Failed to complete quest:", error);
      toast.error("Failed to complete quest");
    } finally {
      setCompletingQuest(null);
    }
  };
  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case "daily_login":
        return <CheckCircle2 className="h-6 w-6" />;
      case "feed_pet":
        return <Heart className="h-6 w-6" />;
      case "earn_xp":
        return <Target className="h-6 w-6" />;
      default:
        return <Zap className="h-6 w-6" />;
    }
  };

  const getQuestColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "available":
        return "text-blue-500";
      case "expired":
        return "text-gray-400";
      default:
        return "text-gray-500";
    }
  };
  if (loading) {
    return (
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Trophy className="h-6 w-6" />
            </div>
            Daily Quests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Loading Progress Bar */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
            </div>

            {/* Loading Quest Items */}
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 animate-pulse"
                >
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-2 bg-gray-200 rounded w-full"></div>
                  </div>
                  <div className="w-20 h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!questSummary) {
    return (
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="bg-gradient-to-r from-gray-500 to-gray-600 text-white">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Trophy className="h-6 w-6" />
            </div>
            Daily Quests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Quests Available
            </h3>
            <p className="text-sm text-gray-500">
              Daily quests will appear here when available
            </p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white pb-8">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 bg-white/20 rounded-lg">
            <Trophy className="h-6 w-6" />
          </div>
          Daily Quests
        </CardTitle>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-6 text-blue-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {questSummary.completed_quests}
              </div>
              <div className="text-xs opacity-80">Completed</div>
            </div>
            <div className="w-px h-8 bg-blue-300/30" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {questSummary.total_quests}
              </div>
              <div className="text-xs opacity-80">Total</div>
            </div>
          </div>
          <Badge
            variant="secondary"
            className="bg-white/20 text-white border-white/30 backdrop-blur-sm font-semibold px-3 py-1"
          >
            {questSummary.total_xp_earned} XP
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Enhanced Overall Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">
                Today's Progress
              </span>
              <span className="text-sm font-bold text-blue-600">
                {questSummary.completion_percentage.toFixed(0)}%
              </span>
            </div>
            <div className="relative">
              <Progress
                value={questSummary.completion_percentage}
                className="h-3 bg-gray-100 [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-indigo-600 [&>div]:transition-all [&>div]:duration-500"
              />
              {questSummary.completion_percentage === 100 && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                >
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </motion.div>
              )}
            </div>
            {questSummary.completion_percentage === 100 && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-green-600 font-medium text-center"
              >
                🎉 Perfect! All daily quests completed!
              </motion.p>
            )}
          </div>
          {/* Quest List */}
          <div className="space-y-4">
            {questSummary.quests.map((quest, index) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                  quest.status === "completed"
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300"
                    : quest.status === "available"
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300 hover:scale-[1.02]"
                    : "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200"
                }`}
              >
                {/* Completion Indicator */}
                {quest.status === "completed" && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-green-500 transform rotate-45 translate-x-8 -translate-y-8">
                    <CheckCircle2 className="absolute bottom-2 left-2 h-4 w-4 text-white transform -rotate-45" />
                  </div>
                )}

                <div className="flex items-center gap-4 p-4">
                  {/* Quest Icon */}
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                      quest.status === "completed"
                        ? "bg-green-100 text-green-600"
                        : quest.status === "available"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400"
                    } transition-colors duration-300`}
                  >
                    {getQuestIcon(quest.daily_quest.quest_type)}
                  </div>

                  {/* Quest Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {quest.daily_quest.title}
                      </h3>
                      {quest.status === "completed" && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 border-green-200 font-medium"
                        >
                          +{quest.xp_awarded} XP
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2">
                      {quest.daily_quest.description}
                    </p>

                    {/* Enhanced Progress Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">
                          Progress
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 font-medium">
                            {quest.current_progress}/{quest.target_progress}
                          </span>
                          {quest.status === "available" && (
                            <Clock className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <Progress
                          value={
                            (quest.current_progress / quest.target_progress) *
                            100
                          }
                          className={`h-2 ${
                            quest.status === "completed"
                              ? "[&>div]:bg-green-500"
                              : quest.status === "available"
                              ? "[&>div]:bg-blue-500"
                              : "[&>div]:bg-gray-400"
                          }`}
                        />
                        {quest.status === "completed" && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
                          >
                            <CheckCircle2 className="h-2 w-2 text-white" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  {quest.status === "available" &&
                    quest.daily_quest.quest_type === "daily_login" && (
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          size="sm"
                          onClick={() => handleCompleteQuest(quest)}
                          disabled={
                            completingQuest === quest.daily_quest.quest_type
                          }
                          className="shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
                        >
                          {completingQuest === quest.daily_quest.quest_type ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Completing...</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Zap className="h-3 w-3" />
                              <span>Complete</span>
                            </div>
                          )}
                        </Button>
                      </motion.div>
                    )}
                </div>
              </motion.div>
            ))}
          </div>{" "}
          {/* Enhanced Empty State */}
          {questSummary.quests.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <Trophy className="h-10 w-10 text-blue-500" />
                </div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-blue-200 rounded-full opacity-20 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                All Caught Up! 🎉
              </h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                You've completed all available daily quests. Check back tomorrow
                for new challenges!
              </p>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
