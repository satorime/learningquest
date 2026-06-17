"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBadgeCollection } from "@/hooks/use-badge-collection";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BadgeArt, badgeArtPropsFromCriteria } from "@/components/badges/badge-art";
import {
  Trophy,
  Award,
  Star,
  Zap,
  Crown,
  Target,
  Flame,
  Users,
  CheckCircle2,
  Lock,
  Medal,
  Gift,
  Flag,
  BookOpen,
  Heart,
  Clock,
  Sparkles,
} from "lucide-react";

interface BadgeDisplayProps {
  showOnlyEarned?: boolean;
  compact?: boolean;
}

export function BadgeCollection({
  showOnlyEarned = false,
  compact = false,
}: BadgeDisplayProps) {
  const { user } = useCurrentUser();
  const [showAllAvailable, setShowAllAvailable] = useState(false);
  const {
    badgeProgress,
    earnedBadges,
    availableBadges,
    loading,
    error,
    refetch,
  } = useBadgeCollection(user?.id);

  if (loading) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className={compact ? "p-0" : ""}>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <div className="space-y-2">
            <p>{error}</p>
            {error.includes("timeout") && (
              <p className="text-sm text-muted-foreground">
                Check that the backend server is running and accessible.
              </p>
            )}
            <div className="space-x-2">
              <Button onClick={refetch} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  const displayBadges = showOnlyEarned ? earnedBadges : badgeProgress;
  const availableBadgesToShow = showAllAvailable
    ? availableBadges
    : availableBadges.slice(0, 5);
  // Show empty state if no badges are available
  if (badgeProgress.length === 0 && !loading && !error) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className={compact ? "p-0" : "pt-6"}>
          <div className="text-center py-8">
            <Medal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Badges Yet</h3>
            <p className="text-muted-foreground mb-4">
              Keep learning — badges unlock as you complete quests, build streaks,
              and grow your pet.
            </p>
            <div className="space-x-2">
              <Button onClick={refetch} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Badge Collection</h3>
          <Badge variant="secondary">
            {earnedBadges.length}/{badgeProgress.length}
          </Badge>
        </div>{" "}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
          {badgeProgress.slice(0, 8).map((badgeItem) => (
            <motion.div
              key={badgeItem.badge.badge_id}
              className="relative flex justify-center"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              title={badgeItem.badge.name}
            >
              <BadgeArt
                {...badgeArtPropsFromCriteria(badgeItem.badge.criteria)}
                earned={badgeItem.earned}
                size={48}
              />
              {badgeItem.earned && (
                <div className="absolute -top-1 -right-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500 bg-white rounded-full" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        {badgeProgress.length > 8 && (
          <Button variant="outline" size="sm" className="w-full">
            View All {badgeProgress.length} Badges
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-4 right-4 opacity-10">
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        >
          <Sparkles className="h-16 w-16 text-amber-500" />
        </motion.div>
      </div>
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              Achievements & Badges
            </CardTitle>
            <CardDescription>
              Collect badges by completing quests and achieving milestones
            </CardDescription>
          </div>

        </div>

        {/* Progress Summary */}
        <div className="flex items-center justify-between mb-4 p-3 bg-primary/5 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-sm md:text-base">
                Badge Progress
              </h3>
              <p className="text-xs text-muted-foreground">
                {earnedBadges.length} of {badgeProgress.length} badges earned
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              {Math.round(
                (earnedBadges.length / Math.max(badgeProgress.length, 1)) * 100
              )}
              %
            </div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Progress
              value={
                (earnedBadges.length / Math.max(badgeProgress.length, 1)) * 100
              }
              className="h-2"
            />{" "}
          </div>
        </div>
      </CardHeader>{" "}
      <CardContent>
        <div className="space-y-6">
          {" "}
          {/* Earned Badges Section */}
          {earnedBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                <h3 className="font-semibold text-sm">
                  Earned Badges ({earnedBadges.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {earnedBadges.map((badgeItem) => (
                  <motion.div
                    key={badgeItem.badge.badge_id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="rounded-lg p-3 border bg-card relative overflow-hidden flex flex-col items-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="mb-2"
                    >
                      <BadgeArt
                        {...badgeArtPropsFromCriteria(badgeItem.badge.criteria)}
                        earned
                        size={64}
                      />
                    </motion.div>

                    {/* Badge info */}
                    <h4 className="font-medium text-xs md:text-sm text-center">
                      {badgeItem.badge.name}
                    </h4>
                    <p className="text-xs text-muted-foreground text-center">
                      {badgeItem.badge.description}
                    </p>

                    {/* Earned indicator */}
                    <div className="absolute top-1 right-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    </div>

                    {/* XP indicator */}
                    <div className="mt-2 text-center">
                      <span className="text-xs font-medium text-amber-600">
                        +{badgeItem.badge.exp_value} XP
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}{" "}
          {/* Available Badges Section */}
          {availableBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm">
                    Available Badges ({availableBadges.length})
                  </h3>
                </div>
                {availableBadges.length > 5 && !showAllAvailable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllAvailable(true)}
                    className="text-xs"
                  >
                    View All
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableBadgesToShow.map((badgeItem) => (
                  <motion.div
                    key={badgeItem.badge.badge_id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-muted/30 rounded-lg p-3 border border-dashed border-muted relative flex flex-col items-center"
                  >
                    {/* Locked medallion (desaturated) */}
                    <div className="mb-2">
                      <BadgeArt
                        {...badgeArtPropsFromCriteria(badgeItem.badge.criteria)}
                        earned={false}
                        size={64}
                      />
                    </div>
                    {/* Badge info */}
                    <h4 className="font-medium text-xs md:text-sm text-center">
                      {badgeItem.badge.name}
                    </h4>
                    <p className="text-xs text-muted-foreground text-center mb-3">
                      {badgeItem.badge.description}
                    </p>
                    {/* Lock indicator */}
                    <div className="absolute top-1 right-1">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>{" "}
                    {/* Progress for locked badges */}
                    {badgeItem.progress ? (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="bg-muted rounded-full h-1 mb-1">
                          <div
                            className="bg-primary h-1 rounded-full"
                            style={{
                              width: `${badgeItem.progress.percentage}%`,
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {badgeItem.progress.current}/
                          {badgeItem.progress.target}
                        </p>
                      </div>
                    ) : (
                      /* XP indicator when no progress */
                      <div className="absolute bottom-2 left-1 right-1 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          +{badgeItem.badge.exp_value} XP
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {showAllAvailable && availableBadges.length > 5 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllAvailable(false)}
                    className="text-xs"
                  >
                    Show Less
                  </Button>{" "}
                </div>
              )}
            </motion.div>
          )}
          {/* Empty state */}
          {earnedBadges.length === 0 && availableBadges.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <Award className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-500">
                No badges available yet. Check back later for new challenges!
              </p>
            </div>
          )}
          {/* Encouraging message */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="mt-6 text-center bg-gradient-to-r from-primary/10 to-amber-500/10 rounded-lg py-3 px-4"
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium">
                Keep going! You're doing great!
              </p>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Complete more quests to unlock new badges
            </p>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
