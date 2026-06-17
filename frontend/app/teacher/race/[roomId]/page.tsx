"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, X, ArrowLeft, Clock } from "lucide-react";
import { DuckTrack } from "@/components/dashboard/duck-track";
import {
  raceService,
  DUCK_COLOR_HEX,
  type RaceState,
  type RaceResults,
} from "@/lib/race-service";
import { useSSENotifications, type SSENotificationData } from "@/hooks/use-sse-notifications";

export default function TeacherRaceMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Number(params.roomId);

  const [state, setState] = useState<RaceState | null>(null);
  const [results, setResults] = useState<RaceResults | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { addNotificationHandler, removeNotificationHandler } = useSSENotifications();

  const refetch = useCallback(async () => {
    try {
      const s = await raceService.state(roomId);
      setState(s);
      if (s.room.status === "finished" && !results) {
        setResults(await raceService.results(roomId).catch(() => null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [roomId, results]);

  useEffect(() => {
    if (roomId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const handler = (d: SSENotificationData) => {
      if (d?.quest_data?.room_id === roomId) refetch();
    };
    addNotificationHandler("race_update", handler);
    return () => removeNotificationHandler("race_update", handler);
  }, [roomId, refetch, addNotificationHandler, removeNotificationHandler]);

  useEffect(() => {
    if (state?.room.status === "finished") return;
    const t = setInterval(refetch, state?.room.status === "playing" ? 1000 : 2500);
    return () => clearInterval(t);
  }, [state?.room.status, refetch]);

  useEffect(() => {
    const room = state?.room;
    if (!room || room.status !== "playing" || !room.current_started_at) return;
    const startedMs = new Date(room.current_started_at).getTime();
    const tick = () => setRemaining(Math.max(0, Math.ceil(room.time_per_question - (Date.now() - startedMs) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state?.room?.current_started_at, state?.room?.status, state?.room?.time_per_question]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      setState(await raceService.start(roomId));
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*?:\s*/, "") : "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    await raceService.close(roomId).catch(() => {});
    router.push("/teacher/dashboard");
  }

  if (!state) {
    return <div className="p-8 text-center text-muted-foreground">{error || "Loading…"}</div>;
  }

  const { room, players } = state;
  const racers = players.filter((p) => !p.is_host);
  const readyCount = racers.filter((p) => p.is_ready).length;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
        </Button>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={close}>
          <X className="mr-1 h-4 w-4" /> End race
        </Button>
      </div>

      {/* Room code */}
      <div className="mb-5 rounded-xl border-2 border-primary bg-primary/5 p-4 text-center">
        <p className="text-xs font-medium text-muted-foreground">SHARE THIS CODE</p>
        <p className="text-4xl font-extrabold tracking-[0.3em]">{room.code}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          🏁 {room.total_tiles} tiles · ⏱ {room.time_per_question}s/Q · {racers.length} joined
        </p>
      </div>

      {/* WAITING — lobby + start */}
      {room.status === "waiting" && (
        <>
          <p className="mb-2 text-sm font-semibold">Players ({racers.length})</p>
          <div className="space-y-2">
            {racers.length === 0 && <p className="text-sm text-muted-foreground">Waiting for students to join…</p>}
            {racers.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm" style={{ backgroundColor: DUCK_COLOR_HEX[p.duck_color] }}>🦆</span>
                  <span className="text-sm font-medium">{p.display_name}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_ready ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                  {p.is_ready ? "Ready" : "Waiting"}
                </span>
              </div>
            ))}
          </div>
          <Button className="mt-5 w-full" size="lg" onClick={start} disabled={busy || readyCount < 2}>
            <Play className="mr-2 h-4 w-4" />
            {readyCount < 2 ? `Need ${2 - readyCount} more ready` : "Start Race"}
          </Button>
          {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}
        </>
      )}

      {/* PLAYING — live track */}
      {room.status === "playing" && (
        <>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Q{room.current_index + 1} / {room.total_questions}</span>
            <span className={`flex items-center gap-1 tabular-nums ${remaining <= 5 ? "font-bold text-rose-500" : "text-muted-foreground"}`}>
              <Clock className="h-4 w-4" /> {remaining}s
            </span>
          </div>
          <DuckTrack players={players} totalTiles={room.total_tiles} />
          <Card className="mt-4">
            <CardContent className="py-4 text-center">
              {room.locked ? (
                <p className="text-sm font-medium text-emerald-600">🏆 {room.locked_by_name} answered first!</p>
              ) : (
                <p className="text-lg font-semibold">{state.current_question?.prompt ?? "…"}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* FINISHED — standings + analytics */}
      {room.status === "finished" && (
        <>
          <h2 className="mb-3 text-xl font-bold">🏁 Final Standings</h2>
          <Card>
            <CardContent className="space-y-2 py-4">
              {(results?.standings ?? []).map((s) => (
                <div key={s.user_id} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center font-semibold">{s.rank <= 3 ? ["🥇", "🥈", "🥉"][s.rank - 1] : s.rank}</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ backgroundColor: DUCK_COLOR_HEX[s.duck_color] }}>🦆</span>
                    <span className="font-medium">{s.display_name}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{s.tile} tiles · {s.correct_answers}✓ / {s.wrong_answers}✗</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {results && results.question_stats.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-base">Question breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {results.question_stats.map((q) => (
                  <div key={q.index} className="text-sm">
                    <p className="truncate font-medium">Q{q.index + 1}. {q.prompt}</p>
                    <p className="text-xs text-muted-foreground">{q.correct_count} correct · {q.wrong_count} wrong</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="mt-5 flex gap-2">
            <Button onClick={() => router.push("/teacher/race")}>New Race</Button>
            <Button variant="outline" onClick={() => router.push("/teacher/dashboard")}>Dashboard</Button>
          </div>
        </>
      )}
    </div>
  );
}
