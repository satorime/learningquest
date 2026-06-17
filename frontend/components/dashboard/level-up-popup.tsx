"use client";

/**
 * Center-screen "Level Up!" popup. Driven by a window `level:up` CustomEvent
 * that the virtual-pet card dispatches when sync detects the level increased.
 * Mounted once near the app root.
 */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowUp, Sparkles, Star } from "lucide-react";

interface LevelUpDetail {
  level: number;
  levelsGained: number;
}

export function LevelUpListener() {
  const [data, setData] = useState<LevelUpDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.level === "number") {
        setData({
          level: detail.level,
          levelsGained:
            typeof detail.levelsGained === "number" ? detail.levelsGained : 1,
        });
      }
    };
    window.addEventListener("level:up", handler as EventListener);
    return () => window.removeEventListener("level:up", handler as EventListener);
  }, []);

  const dismiss = useCallback(() => setData(null), []);

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-2xl"
            initial={{ scale: 0.8, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{ left: `${(i * 31) % 100}%`, top: `${(i * 47) % 100}%` }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: [-2, -28] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    delay: i * 0.14,
                    ease: "easeOut",
                  }}
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                </motion.div>
              ))}
            </div>

            <p className="relative flex items-center justify-center gap-1 text-sm font-semibold text-primary">
              <ArrowUp className="h-4 w-4" /> LEVEL UP!
            </p>

            <motion.div
              className="relative mx-auto my-4 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg"
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: [-10, 8, 0], scale: [0.8, 1.1, 1] }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <Star className="absolute h-28 w-28 text-white/20" />
              <span className="relative text-4xl font-extrabold text-white drop-shadow">
                {data.level}
              </span>
            </motion.div>

            <h3 className="relative text-xl font-bold">
              You reached level {data.level}!
            </h3>
            <p className="relative mt-1 text-sm text-muted-foreground">
              {data.levelsGained > 1
                ? `Your pet grew ${data.levelsGained} levels. Keep it up!`
                : "Your pet grew stronger. Keep learning!"}
            </p>

            <Button className="relative mt-5 w-full" onClick={dismiss}>
              Continue
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
