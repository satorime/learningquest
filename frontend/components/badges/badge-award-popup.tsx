"use client";

/**
 * Global listener that shows a center-screen popup whenever the student earns a
 * badge (auto-awarded or hand-given by a teacher), driven by the "badge_awarded"
 * SSE event. Mounted once near the app root; queues badges so several earned at
 * once are shown one after another.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSSENotifications } from "@/hooks/use-sse-notifications";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { BadgeArt, type BadgeShape } from "@/components/badges/badge-art";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AwardedBadge {
  badge_id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  shape: BadgeShape;
  exp_value: number;
  is_custom: boolean;
}

function toBadge(b: any): AwardedBadge | null {
  if (!b || b.badge_id == null) return null;
  return {
    badge_id: b.badge_id,
    name: b.name ?? "Badge",
    description: b.description ?? "",
    icon: b.icon ?? "award",
    color: b.color ?? "amber",
    shape: (b.shape as BadgeShape) ?? "circle",
    exp_value: b.exp_value ?? 0,
    is_custom: !!b.is_custom,
  };
}

export function BadgeAwardListener() {
  const { addNotificationHandler, removeNotificationHandler } =
    useSSENotifications();
  // Gate the replay fetch on the auth token (not just a user id): auth-context
  // sets the API token before exposing the user, so a present token guarantees
  // getUnseenBadges() is authenticated. Using the localStorage user instead
  // raced ahead of the token and 401'd, so replay never fired.
  const { user } = useAuth();
  const token = user?.token;
  const [queue, setQueue] = useState<AwardedBadge[]>([]);
  const [current, setCurrent] = useState<AwardedBadge | null>(null);
  // Badge ids already shown/queued this session — prevents the live SSE event
  // and the offline-replay fetch from showing the same badge twice.
  const shownIds = useRef<Set<number>>(new Set());

  const enqueue = useCallback((badge: AwardedBadge) => {
    if (shownIds.current.has(badge.badge_id)) return;
    shownIds.current.add(badge.badge_id);
    setQueue((q) => [...q, badge]);
  }, []);

  // Live awards via SSE.
  useEffect(() => {
    const handler = (data: any) => {
      const badge = toBadge(data?.quest_data);
      if (!badge) return;
      enqueue(badge);
      apiClient.ackBadges([badge.badge_id]).catch(() => {});
      try {
        window.dispatchEvent(new CustomEvent("badge:earned"));
      } catch {
        /* ignore */
      }
    };
    addNotificationHandler("badge_awarded", handler);
    return () => removeNotificationHandler("badge_awarded", handler);
  }, [addNotificationHandler, removeNotificationHandler, enqueue]);

  // Offline replay: badges earned while the student wasn't connected pop on
  // their next visit.
  useEffect(() => {
    shownIds.current = new Set(); // fresh per user (and cleared on logout)
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getUnseenBadges();
        if (cancelled || !res?.badges?.length) return;
        res.badges.forEach((b) => {
          const badge = toBadge(b);
          if (badge) enqueue(badge);
        });
        apiClient.ackBadges(res.badges.map((b) => b.badge_id)).catch(() => {});
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, enqueue]);

  // Promote the next queued badge whenever nothing is being shown.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  const dismiss = useCallback(() => setCurrent(null), []);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
            {/* Floating sparkles */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: [-4, -24] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeOut",
                  }}
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                </motion.div>
              ))}
            </div>

            <p className="relative text-sm font-medium text-primary">
              {current.is_custom
                ? "🎉 Your teacher awarded you a badge!"
                : "🎉 Badge unlocked!"}
            </p>

            <motion.div
              className="relative mx-auto my-4 w-fit"
              initial={{ rotate: -8 }}
              animate={{ rotate: [-8, 8, 0], scale: [0.9, 1.08, 1] }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <BadgeArt
                iconName={current.icon}
                color={current.color}
                shape={current.shape}
                size={128}
              />
            </motion.div>

            <h3 className="relative text-xl font-bold">{current.name}</h3>
            {current.description && (
              <p className="relative mt-1 text-sm text-muted-foreground">
                {current.description}
              </p>
            )}
            {current.exp_value > 0 && (
              <p className="relative mt-2 text-sm font-semibold text-amber-600">
                +{current.exp_value} XP
              </p>
            )}

            <Button className="relative mt-5 w-full" onClick={dismiss}>
              Awesome!
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
