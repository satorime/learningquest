"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { apiClient, type DailyQuestSummary } from "@/lib/api-client";

export function DailyQuestsCard({ userId }: { userId: number }) {
  const [summary, setSummary] = useState<DailyQuestSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Opening the dashboard counts as the daily check-in.
        await apiClient.completeDailyLoginQuest(userId).catch(() => {});
        const fresh = await apiClient.getDailyQuestSummary(userId);
        if (cancelled) return;
        setSummary(fresh);
        // The check-in may have granted food — tell the pet card to refresh.
        window.dispatchEvent(new Event("pet:food-changed"));
      } catch {
        /* leave empty on error */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const quests = summary?.quests ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" /> Daily Quests
        </CardTitle>
        <CardDescription>
          Build your study habit — each one earns 🍖 food for your pet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : quests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quests today.</p>
        ) : (
          quests.map((q) => {
            const done = q.status === "completed";
            const target = q.target_progress || 1;
            const pct = Math.min(100, Math.round((q.current_progress / target) * 100));
            return (
              <div key={q.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{q.daily_quest.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.daily_quest.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant={done ? "default" : "secondary"} className="shrink-0">
                    🍖 +2 · {q.daily_quest.xp_reward} XP
                  </Badge>
                </div>
                {!done && target > 1 && (
                  <div className="mt-2">
                    <Progress value={pct} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.current_progress}/{target}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
