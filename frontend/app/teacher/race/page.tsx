"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Flag } from "lucide-react";
import { quizService, type TeacherQuest } from "@/lib/quiz-service";
import { raceService } from "@/lib/race-service";

function Chips({ value, onChange, options, suffix = "" }: { value: number; onChange: (n: number) => void; options: number[]; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            value === n ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          {n}{suffix}
        </button>
      ))}
    </div>
  );
}

export default function TeacherRaceCreatePage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<TeacherQuest[]>([]);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [tiles, setTiles] = useState(10);
  const [time, setTime] = useState(30);
  const [maxP, setMaxP] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    quizService.myQuests().then((qs) => setQuizzes(qs.filter((q) => q.question_count > 0))).catch(() => setQuizzes([]));
  }, []);

  async function create() {
    if (!quizId) {
      setErr("Pick a quiz to use for the race questions.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const s = await raceService.createRoom({
        quiz_id: quizId,
        total_tiles: tiles,
        time_per_question: time,
        max_players: maxP,
      });
      router.push(`/teacher/race/${s.room.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/dashboard")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
      </Button>
      <h1 className="mb-1 text-2xl font-bold">🦆 Create a Duck Race</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Students race ducks by answering your quiz questions — first correct answer advances.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Question Set</CardTitle>
          <CardDescription>Pick one of your quizzes to use as the questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {quizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quizzes with questions yet. Build one first from the dashboard.
            </p>
          ) : (
            quizzes.map((q) => (
              <button
                key={q.quest_id}
                onClick={() => setQuizId(q.quest_id)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                  quizId === q.quest_id ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <span className="font-medium">{q.title}</span>
                <span className="text-xs text-muted-foreground">{q.question_count} questions</span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4">
        <div>
          <p className="mb-2 text-sm font-semibold">🏁 Race length (tiles to win)</p>
          <Chips value={tiles} onChange={setTiles} options={[5, 8, 10, 15, 20]} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">⏱ Time per question</p>
          <Chips value={time} onChange={setTime} options={[10, 15, 20, 30, 45, 60]} suffix="s" />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">👥 Max players</p>
          <Chips value={maxP} onChange={setMaxP} options={[5, 10, 20, 30, 50]} />
        </div>
      </div>

      {err && <p className="mt-4 text-sm text-red-500">{err}</p>}

      <Button className="mt-6 w-full" size="lg" onClick={create} disabled={busy || !quizId}>
        <Flag className="mr-2 h-4 w-4" />
        {busy ? "Creating…" : "Create Room & Get Code"}
      </Button>
    </div>
  );
}
