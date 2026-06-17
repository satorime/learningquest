"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Plus, Users, GraduationCap, FileEdit, ClipboardList, LogOut, Trash2 } from "lucide-react";
import { classService, type ClassItem } from "@/lib/class-service";
import { quizService, type TeacherQuest } from "@/lib/quiz-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { cleanError } from "@/lib/api-client";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

export default function TeacherDashboard() {
  const { logout } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [quizzes, setQuizzes] = useState<TeacherQuest[]>([]);
  const [loading, setLoading] = useState(true);

  // create-quiz dialog
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [difficulty, setDifficulty] = useState("1");
  const [endDate, setEndDate] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [c, q] = await Promise.all([
        classService.listMyClasses(true).catch(() => []),
        quizService.myQuests().catch(() => []),
      ]);
      setClasses(c);
      setQuizzes(q);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createQuiz() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await quizService.createQuest({
        title,
        description: description || undefined,
        class_id: classId ? Number(classId) : null,
        difficulty_level: Number(difficulty),
        end_date: endDate ? new Date(endDate).toISOString() : null,
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
      });
      setOpen(false);
      setTitle(""); setDescription(""); setClassId(""); setDifficulty("1");
      setEndDate(""); setTimeLimit("");
      // Jump straight to the builder to add questions.
      router.push(`/teacher/quests/${created.quest_id}/quiz`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create quiz");
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz(quest: TeacherQuest) {
    const ok = await confirm({
      title: `Delete "${quest.title}"?`,
      description: `This permanently removes the quiz and all ${quest.submission_count} submission(s). This cannot be undone.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await quizService.deleteQuest(quest.quest_id);
      setQuizzes((prev) => prev.filter((q) => q.quest_id !== quest.quest_id));
      await notify({ variant: "success", description: "Quiz deleted." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Failed to delete the quiz.") });
    }
  }

  const totalStudents = classes.reduce((s, c) => s + c.member_count, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Manage your classes and quizzes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
          <Button variant="outline" asChild>
            <Link href="/teacher/classes">
              <GraduationCap className="mr-2 h-4 w-4" /> Classes
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/teacher/race">🦆 Duck Race</Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Quiz
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a quiz</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Class</Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Difficulty</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Easy (20 XP)</SelectItem>
                        <SelectItem value="2">Medium (50 XP)</SelectItem>
                        <SelectItem value="3">Hard (100 XP)</SelectItem>
                        <SelectItem value="4">Epic (150 XP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Deadline (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">No submissions after this time.</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Time limit (minutes, optional)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 30"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Countdown once the student starts.</p>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <DialogFooter>
                <Button onClick={createQuiz} disabled={saving || !title.trim()}>
                  {saving ? "Creating..." : "Create & add questions"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{classes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalStudents}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{quizzes.length}</div></CardContent>
        </Card>
      </div>

      {/* quizzes */}
      <Card>
        <CardHeader>
          <CardTitle>Your Quizzes</CardTitle>
          <CardDescription>Build questions, publish, and grade submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : quizzes.length === 0 ? (
            <p className="text-muted-foreground">No quizzes yet. Create your first one.</p>
          ) : (
            <div className="space-y-3">
              {quizzes.map((q) => (
                <div key={q.quest_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{q.title}</p>
                      <Badge variant={statusVariant[q.status] || "outline"}>{q.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {q.class_title || "No class"} · {q.question_count} questions · {q.submission_count} submissions
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/quests/${q.quest_id}/quiz`}>
                        <FileEdit className="mr-2 h-4 w-4" /> Build
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/teacher/quests/${q.quest_id}/submissions`}>
                        <ClipboardList className="mr-2 h-4 w-4" /> Submissions
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => deleteQuiz(q)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
