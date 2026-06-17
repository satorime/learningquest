"use client";

import { useState, useEffect } from "react";
import {
  apiClient,
  type DailyQuestSummary,
  type UserDailyQuest,
} from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useGlobalXPReward } from "@/contexts/xp-reward-context";
import { toast } from "@/hooks/use-toast";

// Define Quest interface locally until it's properly exported from api-client
interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Epic";
  category: string;
  deadline: string;
  status: "not-started" | "in-progress" | "completed";
}
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BadgeCollection } from "@/components/student/badge-collection";
import { DuckRaceJoinCard } from "@/components/dashboard/duck-race-join";
import { useBadgeCollection } from "@/hooks/use-badge-collection";
import { useSSENotifications } from "@/hooks/use-sse-notifications";
import {
  Trophy,
  Star,
  Medal,
  BookOpen,
  ChevronRight,
  Play,
  Gift,
  Flag,
  Flame,
  Users,
  Sparkles,
  Crown,
  ArrowUp,
  Lock,
  Zap,
  Heart,
  Target,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MiniGame {
  id: string;
  title: string;
  playersCount: number;
  image: string;
  color: string;
  badge: string;
}

interface LeaderboardUser {
  id: number;
  name: string;
  points: number;
  rank: string;
  avatar: string;
}

export default function StudentQuestsPage() {
  const { user: currentUser } = useCurrentUser();
  const { showXPReward, createRewardData } = useGlobalXPReward();

  // Add badge collection hook to get refetch function
  const { refetch: refetchBadges } = useBadgeCollection(currentUser?.id);

  // Add SSE notifications for real-time updates
  const { addNotificationHandler, removeNotificationHandler } =
    useSSENotifications();

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Daily Quest State
  const [questSummary, setQuestSummary] = useState<DailyQuestSummary | null>(
    null
  );
  const [loadingDailyQuests, setLoadingDailyQuests] = useState(true);
  const [completingQuest, setCompletingQuest] = useState<string | null>(null);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mock user data (would come from auth in real app) - fallback for UI components
  const mockUser = {
    name: currentUser?.first_name || currentUser?.username || "User",
    likes: 140,
    followers: 8402,
    expLevel: 14,
    currentExp: 2450,
    maxExp: 4200,
    rank: "MASTER",
    rankPoints: 1200,
    streak: 7,
  };

  // Use current user data where available, fall back to mock for missing fields
  const user = {
    name: currentUser
      ? `${currentUser.first_name || ""} ${
          currentUser.last_name || ""
        }`.trim() || currentUser.username
      : mockUser.name,
    likes: mockUser.likes,
    followers: mockUser.followers,
    expLevel: mockUser.expLevel,
    currentExp: mockUser.currentExp,
    maxExp: mockUser.maxExp,
    rank: mockUser.rank,
    rankPoints: mockUser.rankPoints,
    streak: mockUser.streak,
  };

  // Mock mini games data
  const miniGames: MiniGame[] = [
    {
      id: "language-war",
      title: "Language War",
      playersCount: 82,
      image: "/games/language.png",
      color: "from-blue-500 to-blue-700",
      badge: "🌍",
    },
    {
      id: "questopia",
      title: "Questopia",
      playersCount: 218,
      image: "/games/quest.png",
      color: "from-primary to-primary/80",
      badge: "🧩",
    },
  ];

  // Fetch daily quests
  useEffect(() => {
    const fetchDailyQuests = async () => {
      if (!currentUser?.id) return;

      try {
        setLoadingDailyQuests(true);
        // Opening the app counts as the daily check-in (the only quest that
        // completes this way; the rest complete from the real activity).
        await apiClient.completeDailyLoginQuest(currentUser.id).catch(() => {});
        const summary = await apiClient.getDailyQuestSummary(currentUser.id);
        setQuestSummary(summary);
      } catch (error) {
        console.error("Failed to fetch daily quests:", error);
        toast({
          title: "Error",
          description: "Failed to load daily quests",
          variant: "destructive",
        });
      } finally {
        setLoadingDailyQuests(false);
      }
    };
    fetchDailyQuests();
  }, [currentUser?.id]);

  // Set up SSE notification handler for quest completion events
  useEffect(() => {
    const handleQuestCompletion = async (notification: any) => {
      console.log("Quest completion notification received:", notification);

      // Refresh badge data when a quest is completed via webhook
      try {
        await refetchBadges();

        // Also refresh daily quest summary in case it was a daily quest
        if (currentUser?.id) {
          const updatedSummary = await apiClient.getDailyQuestSummary(
            currentUser.id
          );
          setQuestSummary(updatedSummary);
        }

        // Show a toast notification
        toast({
          title: notification.title || "Quest Completed! 🎉",
          description:
            notification.message || "You may have earned new badges!",
        });
      } catch (error) {
        console.error("Failed to refresh data after quest completion:", error);
      }
    };

    // Add the handler
    addNotificationHandler("quest_completion", handleQuestCompletion);

    // Cleanup
    return () => {
      removeNotificationHandler("quest_completion");
    };
  }, [
    currentUser?.id,
    refetchBadges,
    addNotificationHandler,
    removeNotificationHandler,
  ]);

  // Handle quest completion
  const handleCompleteQuest = async (quest: UserDailyQuest) => {
    if (!currentUser?.id || quest.status === "completed") return;

    try {
      setCompletingQuest(quest.daily_quest.quest_type);
      const result = await apiClient.completeDailyQuest(
        currentUser.id,
        quest.daily_quest.quest_type
      );
      if (result.success) {
        // Show XP reward popup with current progress
        try {
          const progress = await apiClient.fetchStudentProgress(currentUser.id);
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
          toast({
            title: "Quest Completed! 🎉",
            description: `You earned ${result.xp_awarded} XP!`,
          });
        } // Refresh quest summary
        const updatedSummary = await apiClient.getDailyQuestSummary(
          currentUser.id
        );
        setQuestSummary(updatedSummary);

        // Refresh badge data to show any newly earned badges
        try {
          await refetchBadges();
        } catch (badgeError) {
          console.error("Failed to refresh badge data:", badgeError);
          // Don't show error to user as quest was completed successfully
        }
      } else {
        toast({
          title: "Quest Already Completed",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to complete quest:", error);
      toast({
        title: "Error",
        description: "Failed to complete quest",
        variant: "destructive",
      });
    } finally {
      setCompletingQuest(null);
    }
  };

  // Get quest icon based on type
  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case "daily_login":
        return <CheckCircle2 className="h-5 w-5" />;
      case "feed_pet":
        return <Heart className="h-5 w-5" />;
      case "earn_xp":
        return <Target className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  // Enhanced leaderboard data
  const leaderboard: LeaderboardUser[] = [
    {
      id: 1,
      name: "Salsabila P",
      points: 9220,
      rank: "Grand Master",
      avatar: "/avatars/salsabila.png",
    },
    {
      id: 2,
      name: "Syahru M",
      points: 10520,
      rank: "Grand Master",
      avatar: "/avatars/syahru.png",
    },
    {
      id: 3,
      name: "Aditya A",
      points: 8900,
      rank: "Master",
      avatar: "/avatars/aditya.png",
    },
  ];

  useEffect(() => {
    async function fetchQuests() {
      try {
        // Mocking quest data since API client might not have getQuests method yet
        // TODO: Uncomment this when the API endpoint is ready
        // const fetchedQuests = await apiClient.getQuests()
        const mockQuests: Quest[] = [
          {
            id: "1",
            title: "Complete Your Profile",
            description:
              "Update your profile details and add a profile picture",
            xp: 50,
            progress: 75,
            difficulty: "Easy",
            category: "Onboarding",
            deadline: new Date(Date.now() + 86400000).toISOString(),
            status: "in-progress",
          },
          {
            id: "2",
            title: "Welcome to LearningQuest",
            description: "Learn how to navigate the platform",
            xp: 30,
            progress: 100,
            difficulty: "Easy",
            category: "Tutorial",
            deadline: new Date(Date.now() + 86400000).toISOString(),
            status: "completed",
          },
        ];
        setQuests(mockQuests);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quests:", err);
        setError("Failed to load quests");
        setLoading(false);
      }
    }

    fetchQuests();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  const pulseAnimation = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  };

  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8"
    >
      {/* Hero Section */}
      <motion.div
        variants={itemVariants}
        className="bg-background/95 backdrop-blur-lg rounded-2xl md:rounded-3xl border shadow-lg overflow-hidden"
      >
        <div className="relative h-auto md:h-64 lg:h-72">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-purple-500/20 to-blue-500/20">
            {/* Floating particles */}
            {mounted &&
              [...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: Math.random() * 8 + 2 + "px",
                    height: Math.random() * 8 + 2 + "px",
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.5 + 0.2,
                  }}
                  animate={{
                    y: [0, -15, 0],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: Math.random() * 3 + 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}

            {/* Path pattern */}
            <svg
              className="absolute inset-0 w-full h-full opacity-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M0,50 Q25,30 50,50 T100,50"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M0,60 Q35,40 70,60 T100,60"
                stroke="white"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M0,40 Q45,20 90,40 T100,40"
                stroke="white"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col md:flex-row items-center md:justify-between p-6 md:p-8 gap-4 md:gap-6">
            <div className="text-center md:text-left">
              <motion.div
                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium mb-3 md:mb-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Flame className="h-3 w-3 md:h-4 md:w-4" /> {user.streak} Day
                Streak
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-2"
              >
                Ready for New <span className="text-primary">Quests?</span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-sm md:text-base lg:text-lg text-muted-foreground md:max-w-md"
              >
                Challenge yourself with fun quests, earn experience points and
                climb the ranks!
              </motion.p>

              <motion.div
                variants={itemVariants}
                className="flex flex-wrap gap-3 md:gap-4 mt-3 md:mt-4 justify-center md:justify-start"
              >
                <Button
                  size="sm"
                  className="rounded-full bg-primary hover:bg-primary/90 gap-2 text-xs md:text-sm"
                >
                  <Play className="h-3 w-3 md:h-4 md:w-4" /> Start Challenge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-2 text-xs md:text-sm"
                >
                  Daily Rewards <Gift className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </motion.div>
            </div>

            <motion.div
              variants={itemVariants}
              className="hidden md:block relative"
            >
              <motion.div
                animate={pulseAnimation.animate}
                initial={pulseAnimation.initial}
                className="relative"
              >
                <div className="h-40 w-40 relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl"></div>
                  <div className="relative z-10 h-full w-full flex items-center justify-center">
                    <div className="relative w-24 h-24">
                      <div className="absolute bottom-0 w-full h-3/5 bg-amber-800 rounded-md"></div>

                      <motion.div
                        className="absolute top-0 w-full h-2/5 bg-amber-700 rounded-t-md origin-bottom"
                        animate={{ rotateX: [0, -30, 0] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          repeatDelay: 3,
                          ease: "easeInOut",
                        }}
                      >
                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-yellow-600 rounded-sm border-2 border-yellow-800"></div>
                      </motion.div>

                      <motion.div
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.7, 1, 0.7],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }}
                      >
                        <div className="flex gap-1">
                          <div className="h-3 w-3 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50"></div>
                          <div className="h-2 w-2 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"></div>
                          <div className="h-4 w-4 bg-primary rounded-full shadow-lg shadow-primary/50"></div>
                        </div>
                      </motion.div>

                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute top-1/3 left-1/2"
                          initial={{
                            x: Math.random() * 20 - 10,
                            y: 0,
                            opacity: 0,
                            scale: 0,
                          }}
                          animate={{
                            y: -30,
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.6,
                            repeatDelay: Math.random() * 2,
                          }}
                        >
                          <Sparkles
                            className={`h-3 w-3 ${
                              [
                                "text-yellow-400",
                                "text-primary",
                                "text-blue-400",
                              ][Math.floor(Math.random() * 3)]
                            }`}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={floatAnimation.animate}
                initial={floatAnimation.initial}
                className="absolute -top-4 -right-4 bg-amber-500/10 backdrop-blur-sm rounded-full p-3 shadow-lg border border-amber-500/20"
              >
                <Star className="h-6 w-6 text-amber-500" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* User Overview Section */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
      >
        {/* Player Card */}
         

        {/* Streak Card */}
        {/* <motion.div
          whileHover={{ scale: 1.02, y: -5 }}
          className="bg-background/95 backdrop-blur-lg rounded-xl border p-4 md:p-6"
        >
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
            <Flame className="h-4 w-4 text-red-500" /> Your Streak
          </h3>

          <div className="flex justify-between mb-3">
            {[...Array(7)].map((_, index) => (
              <motion.div
                key={index}
                className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
                  index < user.streak ? "bg-amber-500 text-white" : "bg-muted"
                }`}
                whileHover={{ scale: 1.1 }}
              >
                {index < user.streak ? (
                  <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-xs md:text-sm text-muted-foreground">
              You're on a {user.streak} day streak!
            </p>
            <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs">
              <Flag className="h-3 w-3" /> Keep going
            </Button>
          </div>
        </motion.div> */}

        {/* Rank Card */}
        {/* <motion.div
          whileHover={{ scale: 1.02, y: -5 }}
          className="bg-background/95 backdrop-blur-lg rounded-xl border p-4 md:p-6 sm:col-span-2 md:col-span-1"
        >
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
            <Trophy className="h-4 w-4 text-amber-500" /> Your Rank
          </h3>

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex flex-col items-center">
              <motion.div
                className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center"
                animate={{ y: [0, -5, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              >
                <Trophy className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </motion.div>
              <div className="text-xs mt-1 text-muted-foreground text-center">
                Your Position
              </div>
            </div>

            <div className="text-2xl md:text-3xl font-bold text-primary">
              {leaderboard.findIndex((l) => l.name === user.name) + 1 || 4}
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs md:text-sm text-muted-foreground">
              Rank points:{" "}
              <span className="font-medium text-foreground">
                {user.rankPoints}
              </span>
            </p>
            <Link href="/dashboard/leaderboard">
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1 rounded-full text-xs"
              >
                View Leaderboard <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </motion.div> */}
      </motion.div>

      {/* Mini Games Section */}
      <motion.div variants={itemVariants}>
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-2xl font-bold">Interactive Games</h2>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs md:text-sm"
          >
            Browse All <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Playable: Pet Feast math game */}
          <Link href="/dashboard/games/pet-feast" className="block">
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.03, y: -5 }}
              className="group h-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg"
            >
              <div className="relative flex h-36 flex-col p-4 text-white md:h-44 md:p-6">
                <div className="absolute right-4 top-4 text-3xl md:text-4xl">🍖</div>
                <h3 className="mb-1 text-lg font-bold md:text-xl">Pet Feast</h3>
                <div className="mb-2 flex items-center gap-1 text-xs md:text-sm">
                  <BookOpen className="h-3 w-3" /> <span>Mathematics</span>
                </div>
                <p className="text-xs text-white/90 md:text-sm">
                  Answer math to feed your pet &amp; earn food + XP.
                </p>
                <span className="mt-auto inline-flex w-fit items-center rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium transition-colors group-hover:bg-white/30">
                  <Play className="mr-1 h-3 w-3" /> Play Now
                </span>
              </div>
            </motion.div>
          </Link>

          {/* Playable: Math Duck Race (multiplayer) */}
          <motion.div variants={itemVariants} whileHover={{ scale: 1.03, y: -5 }} className="relative">
            <DuckRaceJoinCard />
          </motion.div>

          {miniGames.map((game, index) => (
            <motion.div
              key={game.id}
              variants={itemVariants}
              whileHover={{ scale: 1.03, y: -5 }}
              className={`bg-gradient-to-br ${game.color} rounded-xl overflow-hidden border border-white/10 shadow-lg`}
            >
              <div className="h-36 md:h-44 relative p-4 md:p-6 text-white">
                {/* Game badge */}
                <motion.div
                  className="text-3xl md:text-4xl absolute top-4 right-4"
                  animate={{
                    y: [0, -5, 0],
                    rotate: [0, 5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.2,
                  }}
                >
                  {game.badge}
                </motion.div>

                <div className="absolute inset-0 overflow-hidden">
                  {mounted &&
                    [...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full opacity-20"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                          y: [0, -20],
                          opacity: [0.2, 0],
                        }}
                        transition={{
                          duration: Math.random() * 2 + 1,
                          repeat: Infinity,
                          repeatType: "loop",
                        }}
                      />
                    ))}
                </div>

                {/* Overlay - locked state */}
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                  <Lock className="h-8 w-8 text-white/80 mb-2" />
                  <div className="text-white font-semibold text-lg">
                    Coming Soon
                  </div>
                  <div className="text-white/70 text-xs mt-1">
                    Future Update
                  </div>
                </div>

                <div className="relative z-10">
                  <h3 className="text-lg md:text-xl font-bold mb-1">
                    {game.title}
                  </h3>
                  <div className="flex items-center text-xs md:text-sm space-x-1 mb-3">
                    <Users className="h-3 w-3" />
                    <span>{game.playersCount} playing now</span>
                  </div>

                  <AnimatePresence>
                    {selectedGame === game.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs md:text-sm"
                      >
                        <p className="mb-2">
                          Quick match with other players in a fun, educational
                          game.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    size="sm"
                    className="mt-2 bg-white/20 hover:bg-white/30 text-white border-white/10 rounded-full text-xs"
                    disabled
                  >
                    <Play className="h-3 w-3 mr-1" /> Play Now
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}{" "}
        </div>
      </motion.div>

      {/* Daily Quests & Leaderboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Quests */}
        <motion.div variants={itemVariants}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Flag className="h-4 w-4 md:h-5 md:w-5 text-primary" /> Daily
              Quests
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
            >
              Claim All
            </Button>
          </div>
          <div className="space-y-4">
            {loadingDailyQuests ? (
              // Loading state
              [...Array(3)].map((_, index) => (
                <div
                  key={index}
                  className="bg-background/95 backdrop-blur-lg rounded-xl border p-4 md:p-5 animate-pulse"
                >
                  <div className="flex items-center gap-3 md:gap-4 mb-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-2 bg-muted rounded"></div>
                    </div>
                    <div className="w-16 h-8 bg-muted rounded-full"></div>
                  </div>
                </div>
              ))
            ) : questSummary?.quests && questSummary.quests.length > 0 ? (
              // Real quest data
              questSummary.quests.map((quest) => (
                <motion.div
                  key={quest.daily_quest.quest_type}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="bg-background/95 backdrop-blur-lg rounded-xl border p-4 md:p-5 transition-all"
                >
                  <div className="flex items-center gap-3 md:gap-4 mb-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {getQuestIcon(quest.daily_quest.quest_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm md:text-base truncate">
                        {quest.daily_quest.title}
                      </h3>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        {quest.daily_quest.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        <span className="text-xs md:text-sm text-amber-500 font-medium">
                          +{quest.daily_quest.xp_reward} XP
                        </span>
                        <span className="text-xs md:text-sm font-medium">🍖 +2</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {" "}
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span>
                          {quest.current_progress}/{quest.target_progress}
                        </span>
                      </div>
                      <Progress
                        value={
                          (quest.current_progress / quest.target_progress) * 100
                        }
                        className="h-1.5"
                      />
                    </div>

                    {/* Status only — quests complete automatically from the
                        real activity, never from a button click. */}
                    <div
                      className={`flex items-center gap-1 rounded-full px-3 md:px-4 py-1.5 text-xs font-medium ${
                        quest.status === "completed"
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {quest.status === "completed" ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Done</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          <span>In progress</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              // Empty state
              <div className="bg-background/95 backdrop-blur-lg rounded-xl border p-6 md:p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-base mb-2">
                  No Daily Quests Available
                </h3>
                <p className="text-sm text-muted-foreground">
                  Check back tomorrow for new daily quests!
                </p>
              </div>
            )}

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl p-4 md:p-5 flex justify-between items-center"
            >
              <div className="flex items-center gap-2 md:gap-3">
                <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-medium text-sm md:text-base">
                  More quests coming soon!
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Tomorrow</span>
            </motion.div>
          </div>{" "}
        </motion.div>

        {/* Achievements & Badges */}
        <motion.div variants={itemVariants}>
          <BadgeCollection />
        </motion.div>
      </div>
    </motion.div>
  );
}
