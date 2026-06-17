"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Crown, ArrowLeft } from "lucide-react";
import { DuckTrack } from "@/components/dashboard/duck-track";
import {
  raceService,
  DUCK_COLOR_HEX,
  type RaceState,
  type RaceResults,
} from "@/lib/race-service";
import { useSSENotifications, type SSENotificationData } from "@/hooks/use-sse-notifications";

const COLORS = ["yellow", "orange", "pink", "blue", "green", "purple", "red"];

export default function DuckRacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roomId = Number(params.roomId);
  const myId = user?.id ? Number(user.id) : undefined;

  const [state, setState] = useState<RaceState | null>(null);
  const [results, setResults] = useState<RaceResults | null>(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const answeredIndexRef = useRef<number>(-1);
  const { addNotificationHandler, removeNotificationHandler } = useSSENotifications();

  const refetch = useCallback(async () => {
    try {
      const s = await raceService.state(roomId);
      setState(s);
      if (s.room.status === "finished" && !results) {
        setResults(await raceService.results(roomId).catch(() => null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load race");
    }
  }, [roomId, results]);

  useEffect(() => {
    if (roomId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Live updates via SSE, plus a light poll as a fallback / for the timer.
  useEffect(() => {
    const handler = (d: SSENotificationData) => {
      if (d?.quest_data?.room_id === roomId) refetch();
    };
    addNotificationHandler("race_update", handler);
    return () => removeNotificationHandler("race_update", handler);
  }, [roomId, refetch, addNotificationHandler, removeNotificationHandler]);

  useEffect(() => {
    const status = state?.room.status;
    if (status === "finished") return;
    const interval = status === "playing" ? 1000 : 2500;
    const t = setInterval(refetch, interval);
    return () => clearInterval(t);
  }, [state?.room.status, refetch]);

  // Reset per-question feedback when the question changes.
  useEffect(() => {
    if (!state?.current_question) return;
    if (answeredIndexRef.current !== state.current_question.index) {
      setFeedback(null);
      setTextAnswer("");
    }
  }, [state?.current_question?.index]);

  // Countdown derived from the server's question start time.
  useEffect(() => {
    const room = state?.room;
    if (!room || room.status !== "playing" || !room.current_started_at) {
      setRemaining(0);
      return;
    }
    const startedMs = new Date(room.current_started_at).getTime();
    const tick = () => {
      const elapsed = (Date.now() - startedMs) / 1000;
      setRemaining(Math.max(0, Math.ceil(room.time_per_question - elapsed)));
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state?.room?.current_started_at, state?.room?.status, state?.room?.time_per_question]);

  const submit = useCallback(
    async (answer: string) => {
      if (!state?.current_question) return;
      answeredIndexRef.current = state.current_question.index;
      try {
        const res = await raceService.answer(roomId, answer);
        setFeedback(res.correct);
      } catch {
        setFeedback(false);
      }
      refetch();
    },
    [roomId, state, refetch]
  );

  async function toggleReady(color?: string) {
    if (!state) return;
    const me = state.players.find((p) => p.user_id === myId);
    try {
      const s = await raceService.ready(roomId, color ? (me?.is_ready ?? false) : !(me?.is_ready ?? false), color);
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!state) {
    return <div className="p-8 text-center text-muted-foreground">{error || "Loading race…"}</div>;
  }

  const { room, players, current_question } = state;
  const me = players.find((p) => p.user_id === myId);
  const answered = state.me.already_answered || answeredIndexRef.current === current_question?.index;

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (room.status === "finished") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">🏁 Race Finished</h1>
        {results?.standings[0] && (
          <p className="mb-4 flex items-center gap-1 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="font-semibold">{results.standings[0].display_name}</span> wins!
          </p>
        )}
        <Card>
          <CardContent className="space-y-2 py-4">
            {(results?.standings ?? []).map((s) => (
              <div
                key={s.user_id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.user_id === myId ? "bg-primary/5" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 text-center font-semibold">
                    {s.rank <= 3 ? ["🥇", "🥈", "🥉"][s.rank - 1] : s.rank}
                  </span>
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-xs"
                    style={{ backgroundColor: DUCK_COLOR_HEX[s.duck_color] }}
                  >
                    🦆
                  </span>
                  <span className="font-medium">{s.display_name}{s.user_id === myId ? " (you)" : ""}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {s.tile} tiles · {s.correct_answers}✓
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Button className="mt-5" variant="outline" onClick={() => router.push("/student/quests")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quests
        </Button>
      </div>
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold">🦆 Race Lobby</h1>
        <div className="my-4 rounded-xl border-2 border-primary bg-primary/5 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">ROOM CODE</p>
          <p className="text-4xl font-extrabold tracking-[0.3em]">{room.code}</p>
        </div>

        <p className="mb-2 text-sm font-semibold">Players ({players.length})</p>
        <div className="space-y-2">
          {players.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between rounded-lg border p-2.5">
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm" style={{ backgroundColor: DUCK_COLOR_HEX[p.duck_color] }}>🦆</span>
                <span className="text-sm font-medium">{p.display_name}{p.user_id === myId ? " (you)" : ""}{p.is_host ? " 👑" : ""}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_ready ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                {p.is_host ? "Host" : p.is_ready ? "Ready" : "Waiting"}
              </span>
            </div>
          ))}
        </div>

        {me && !me.is_host && (
          <div className="mt-5 space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Pick your duck</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleReady(c)}
                    className={`h-9 w-9 rounded-full ring-2 transition ${me.duck_color === c ? "ring-primary" : "ring-transparent"}`}
                    style={{ backgroundColor: DUCK_COLOR_HEX[c] }}
                    aria-label={c}
                  >
                    🦆
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" variant={me.is_ready ? "outline" : "default"} onClick={() => toggleReady()}>
              {me.is_ready ? "Not ready" : "I'm ready! ✅"}
            </Button>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">Waiting for the teacher to start the race…</p>
        {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // ── RACE ───────────────────────────────────────────────────────────────
  const lowTime = remaining <= 5;
  return (
    <div className="container mx-auto max-w-xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Q{room.current_index + 1} / {room.total_questions}
        </span>
        <span className={`flex items-center gap-1 text-sm tabular-nums ${lowTime ? "font-bold text-rose-500" : "text-muted-foreground"}`}>
          <Clock className="h-4 w-4" /> {remaining}s
        </span>
      </div>

      <div className="mb-4">
        <DuckTrack players={players} totalTiles={room.total_tiles} myUserId={myId} />
      </div>

      <Card>
        <CardContent className="py-5">
          {room.locked ? (
            <p className="text-center text-sm font-medium text-emerald-600">
              🏆 {room.locked_by_name} answered first! Next question…
            </p>
          ) : current_question ? (
            <>
              <div className="mb-4 text-center text-xl font-bold md:text-2xl">{current_question.prompt}</div>
              {current_question.type === "short_answer" ? (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (textAnswer.trim()) submit(textAnswer.trim()); }}
                  className="flex gap-2"
                >
                  <Input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Your answer" disabled={answered} />
                  <Button type="submit" disabled={answered || !textAnswer.trim()}>Buzz!</Button>
                </form>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {current_question.choices.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => submit(String(c.id))}
                      disabled={answered}
                      className="min-h-[3rem] break-words rounded-xl border bg-card px-4 py-3 text-lg font-semibold shadow-sm transition-all hover:border-primary hover:bg-accent disabled:opacity-60"
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 h-5 text-center text-sm font-medium">
                {answered && feedback === true && <span className="text-emerald-600">Correct! 🎉</span>}
                {answered && feedback === false && <span className="text-rose-600">Wrong — wait for the next one.</span>}
                {answered && feedback === null && <span className="text-muted-foreground">Answer locked in…</span>}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground">Get ready…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
