"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { raceService } from "@/lib/race-service";

export function DuckRaceJoinCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function join() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setErr("");
    try {
      const s = await raceService.join(c);
      router.push(`/dashboard/games/duck-race/${s.room.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?:\s*/, "") : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg">
      <div className="flex h-36 flex-col p-4 text-white md:h-44 md:p-6">
        <div className="absolute right-4 top-4 text-3xl md:text-4xl">🦆</div>
        <h3 className="mb-1 text-lg font-bold md:text-xl">Math Duck Race</h3>
        <p className="mb-2 text-xs text-white/90 md:text-sm">
          Race classmates — join your teacher&apos;s room by code.
        </p>
        <div className="mt-auto flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="CODE"
            maxLength={8}
            className="w-full rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold uppercase tracking-widest text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <button
            onClick={join}
            disabled={busy || !code.trim()}
            className="shrink-0 rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-white disabled:opacity-50"
          >
            {busy ? "…" : "Join"}
          </button>
        </div>
        {err && <p className="mt-1 text-xs text-white/90">{err}</p>}
      </div>
    </div>
  );
}
