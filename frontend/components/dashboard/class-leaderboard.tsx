"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy } from "lucide-react";
import {
  leaderboardService,
  type ClassLeaderboardEntry,
} from "@/lib/leaderboard-service";
import { useSSENotifications, type SSENotificationData } from "@/hooks/use-sse-notifications";

const MEDALS = ["🥇", "🥈", "🥉"];

export function ClassLeaderboard({
  classes,
}: {
  classes: { id: number; title: string }[];
}) {
  const [selected, setSelected] = useState<string>("");
  const [rows, setRows] = useState<ClassLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { addNotificationHandler, removeNotificationHandler } = useSSENotifications();

  // Default to the first class once classes load.
  useEffect(() => {
    if (!selected && classes.length > 0) setSelected(String(classes[0].id));
  }, [classes, selected]);

  const load = useCallback(async (classId: number) => {
    setLoading(true);
    try {
      setRows(await leaderboardService.getClassLeaderboard(classId));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) load(Number(selected));
  }, [selected, load]);

  // Live refresh: re-fetch when a score changes in the selected class.
  useEffect(() => {
    if (!selected) return;
    const classId = Number(selected);
    const handler = (data: SSENotificationData) => {
      if (data?.quest_data?.class_id === classId) load(classId);
    };
    addNotificationHandler("leaderboard_update", handler);
    return () => removeNotificationHandler("leaderboard_update", handler);
  }, [selected, addNotificationHandler, removeNotificationHandler, load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" /> Class Leaderboard
        </CardTitle>
        <CardDescription>Top 10 in your class · updates live</CardDescription>
        {classes.length > 1 && (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Join a class to see its leaderboard.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rankings yet — be the first to earn points!</p>
        ) : (
          <ol className="space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.rank}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm odd:bg-muted/40"
              >
                <span className="w-6 text-center">
                  {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                </span>
                <span className="truncate">{r.name}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
