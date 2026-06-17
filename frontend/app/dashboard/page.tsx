"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  GraduationCap,
  LogOut,
  ArrowRight,
  Trophy,
  Star,
  Award,
  Flame,
  Zap,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { VirtualPet } from "@/components/dashboard/virtual-pet";
import { DailyQuestsCard } from "@/components/dashboard/daily-quests-card";
import { ClassLeaderboard } from "@/components/dashboard/class-leaderboard";
import { classService, type ClassItem } from "@/lib/class-service";
import { quizService, type StudentQuest } from "@/lib/quiz-service";
import { getMyPet } from "@/lib/virtual-pet-api";
import { apiClient } from "@/lib/api-client";
import { useSSENotifications } from "@/hooks/use-sse-notifications";

type Tab = "all" | "in_progress" | "completed";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [classFilter, setClassFilter] = useState<number | "all">("all");
  const [stats, setStats] = useState({ totalXp: 0, level: 1, questsDone: 0, achievements: 0, streak: 0 });
  const [levelInfo, setLevelInfo] = useState({ into: 0, next: 0, pct: 0 });
  const { addNotificationHandler, removeNotificationHandler } = useSSENotifications();

  const loadQuizzes = useCallback(async () => {
    setQuizzes(await quizService.availableQuests().catch(() => []));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyStats = (
      progress: { total_exp?: number; quests_completed?: number; badges_earned?: number } | null,
      pet: any | null,
      streakCurrent: number
    ) => {
      setStats({
        totalXp: progress?.total_exp ?? 0,
        level: pet?.level ?? 1,
        questsDone: progress?.quests_completed ?? 0,
        achievements: progress?.badges_earned ?? 0,
        streak: streakCurrent,
      });
      if (pet) {
        setLevelInfo({
          into: pet.exp_into_level ?? 0,
          next: pet.exp_for_next_level ?? 0,
          pct: pet.exp_progress ?? 0,
        });
      }
    };

    // Fallback: the original per-endpoint fetches, used only if the combined
    // summary call fails.
    const loadIndividually = async () => {
      const [c, q] = await Promise.all([
        classService.myEnrolledClasses().catch(() => []),
        quizService.availableQuests().catch(() => []),
      ]);
      if (cancelled) return;
      setClasses(c);
      setQuizzes(q);
      setLoading(false);
      if (user?.id) {
        const uid = Number(user.id);
        const [progress, petRes, streakRes] = await Promise.all([
          apiClient.fetchStudentProgress(uid).catch(() => null),
          getMyPet().catch(() => null),
          apiClient.getUserStreak(uid).catch(() => null),
        ]);
        if (cancelled) return;
        applyStats(progress, petRes?.pet, streakRes?.streak?.current_streak ?? 0);
      }
    };

    // One request for the whole dashboard; fall back to the individual
    // endpoints if it's unavailable.
    (async () => {
      try {
        const s = await apiClient.getDashboardSummary();
        if (cancelled) return;
        setClasses((s.classes as ClassItem[]) ?? []);
        setQuizzes((s.quizzes as StudentQuest[]) ?? []);
        setLoading(false);
        applyStats(s.progress, s.pet, s.streak?.streak?.current_streak ?? 0);
      } catch {
        await loadIndividually();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Live: a teacher publishing a quiz makes it appear here without refresh.
  useEffect(() => {
    const handler = () => loadQuizzes();
    addNotificationHandler("quiz_published", handler);
    return () => removeNotificationHandler("quiz_published", handler);
  }, [addNotificationHandler, removeNotificationHandler, loadQuizzes]);

  // Narrow by selected class first, then the status tab counts/cards follow it
  // so they stay consistent with whatever class is in view.
  const byClass =
    classFilter === "all"
      ? quizzes
      : quizzes.filter((q) => q.class_id === classFilter);
  const completedCount = byClass.filter((q) => q.submission_status === "completed").length;
  const completedPct = byClass.length ? Math.round((completedCount / byClass.length) * 100) : 0;
  const inProgressCount = byClass.length - completedCount;
  const filtered = byClass.filter((q) =>
    tab === "all"
      ? true
      : tab === "completed"
      ? q.submission_status === "completed"
      : q.submission_status !== "completed"
  );

  const firstName = user?.name ? user.name.split(" ")[0] : "";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back{firstName ? `, ${firstName}` : ""} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Track your progress, complete quizzes, and level up your learning journey.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.streak > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" /> {stats.streak} Day Streak
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      {/* stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total XP" value={stats.totalXp} icon={<Star className="h-5 w-5" />} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Current Level" value={stats.level} icon={<Zap className="h-5 w-5" />} gradient="from-amber-500 to-orange-600" />
        <StatCard label="Quizzes Done" value={stats.questsDone} icon={<CheckCircle2 className="h-5 w-5" />} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Achievements" value={stats.achievements} icon={<Award className="h-5 w-5" />} gradient="from-sky-500 to-blue-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* QUEST BOARD — the highlight */}
        <Card className="lg:col-span-2 border-primary/30 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BookOpen className="h-5 w-5 text-primary" /> Quest Board
                </CardTitle>
                <CardDescription>Complete quizzes to earn XP, food, and level up.</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{completedPct}%</div>
                <div className="text-xs text-muted-foreground">completed</div>
              </div>
            </div>

            {/* class filter — only shown when enrolled in more than one class */}
            {classes.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                <select
                  value={classFilter}
                  onChange={(e) =>
                    setClassFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="w-full max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">All Classes ({quizzes.length})</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({quizzes.filter((q) => q.class_id === c.id).length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* tabs */}
            <div className="mt-3 flex flex-wrap gap-2">
              <TabPill active={tab === "all"} onClick={() => setTab("all")} label={`All Quizzes (${byClass.length})`} />
              <TabPill active={tab === "in_progress"} onClick={() => setTab("in_progress")} label={`In Progress (${inProgressCount})`} />
              <TabPill active={tab === "completed"} onClick={() => setTab("completed")} label={`Completed (${completedCount})`} />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                {quizzes.length === 0
                  ? "No quizzes yet — join a class to get started."
                  : byClass.length === 0
                  ? "No quizzes in this class yet."
                  : "Nothing here. Switch tabs to see your other quizzes."}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((q) => (
                  <QuizCard key={q.quest_id} quiz={q} onOpen={() => router.push(`/dashboard/quests/${q.quest_id}/take`)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: pet + level */}
        <div className="space-y-6">
          <VirtualPet />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Level {stats.level}</CardTitle>
              <Star className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">XP Progress</span>
                <span className="font-medium">
                  {levelInfo.next > 0 ? `${levelInfo.into} / ${levelInfo.next}` : "Max"}
                </span>
              </div>
              <Progress value={levelInfo.pct} className="h-2" />
              <div className="flex justify-between pt-1 text-sm">
                <span className="text-muted-foreground">Total XP</span>
                <span className="font-semibold">{stats.totalXp}</span>
              </div>
            </CardContent>
          </Card>

          {/* My Classes quick link */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5" /> My Classes
              </CardTitle>
              <CardDescription>{classes.length} enrolled</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/classes">
                  Manage classes <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* daily quests + leaderboard */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {user?.id && <DailyQuestsCard userId={Number(user.id)} />}
        <ClassLeaderboard classes={classes.map((c) => ({ id: c.id, title: c.title }))} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-sm/none opacity-90">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}

function TabPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  );
}

const DIFFICULTY: Record<number, { label: string; className: string }> = {
  1: { label: "Easy", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  2: { label: "Medium", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  3: { label: "Hard", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  4: { label: "Epic", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
};

function QuizCard({ quiz, onOpen }: { quiz: StudentQuest; onOpen: () => void }) {
  const diff = DIFFICULTY[quiz.difficulty_level] ?? DIFFICULTY[1];

  // Progress + accent reflect the submission state.
  let pct = 0;
  let barClass = "bg-muted-foreground/30";
  let progressLabel = "Not started";
  if (quiz.submission_status === "completed") {
    pct = 100;
    barClass = "bg-emerald-500";
    progressLabel =
      quiz.max_score != null ? `Completed · ${quiz.score}/${quiz.max_score}` : "Completed";
  } else if (quiz.submission_status === "submitted") {
    pct = 100;
    barClass = "bg-amber-500";
    progressLabel = "Turned in · awaiting grade";
  }

  const notStarted = quiz.submission_status === "not_started";

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* title + difficulty */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{quiz.title}</p>
          {quiz.class_title && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{quiz.class_title}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${diff.className}`}>
          {diff.label}
        </span>
      </div>

      {/* description — clamped to 2 lines so every card stays the same height;
          full text is shown on the quest page (and on hover via title). */}
      {quiz.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground" title={quiz.description}>
          {quiz.description}
        </p>
      )}

      {/* rewards / meta */}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
          <Trophy className="h-4 w-4" /> {quiz.exp_reward} XP
        </span>
        {quiz.time_limit_minutes ? (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" /> {quiz.time_limit_minutes}m
          </span>
        ) : null}
      </div>

      {/* progress */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{progressLabel}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* mt-auto pins the button to the bottom so cards align regardless of
          how long the description/meta above is; pt-4 keeps a minimum gap. */}
      <div className="mt-auto pt-4">
        <Button
          className="w-full"
          variant={notStarted ? "default" : "outline"}
          onClick={onOpen}
        >
          {notStarted ? "Start Quiz" : "View Quest"}
        </Button>
      </div>
    </div>
  );
}
