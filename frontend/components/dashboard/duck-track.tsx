"use client";

import { DUCK_COLOR_HEX, type RacePlayer } from "@/lib/race-service";

export function DuckTrack({
  players,
  totalTiles,
  myUserId,
}: {
  players: RacePlayer[];
  totalTiles: number;
  myUserId?: number;
}) {
  return (
    <div className="space-y-2">
      {players.map((p) => {
        const frac = totalTiles > 0 ? Math.min(1, p.tile / totalTiles) : 0;
        const leftPct = 4 + frac * 86; // keep the duck on-track at both ends
        const me = p.user_id === myUserId;
        const hex = DUCK_COLOR_HEX[p.duck_color] ?? DUCK_COLOR_HEX.yellow;
        return (
          <div key={p.user_id} className="rounded-lg border bg-card/60 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={`truncate font-medium ${me ? "text-primary" : ""}`}>
                {p.display_name}
                {me ? " (you)" : ""}
                {p.is_host ? " 👑" : ""}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {p.tile}/{totalTiles}
              </span>
            </div>
            <div className="relative h-8 overflow-hidden rounded-full bg-gradient-to-r from-sky-100 to-emerald-100 dark:from-sky-950/40 dark:to-emerald-950/40">
              {/* finish flag */}
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-base">🏁</span>
              {/* duck */}
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
                style={{ left: `${leftPct}%` }}
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm shadow ring-2 ring-white/70"
                  style={{ backgroundColor: hex }}
                >
                  🦆
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
