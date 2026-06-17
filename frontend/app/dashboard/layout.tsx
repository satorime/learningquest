"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * The student dashboard hosts the gamified, per-student features (virtual pet,
 * XP, quests, badges, streaks). Only students belong here — teachers and admins
 * are redirected to their own areas.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/signin");
    } else if (user.role === "admin") {
      router.replace("/admin");
    } else if (user.role === "teacher") {
      router.replace("/teacher");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "student") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <div className="min-h-screen bg-transparent">{children}</div>;
}
