"use client";

import { useEffect, useState } from "react";
import { ClassLeaderboard } from "@/components/dashboard/class-leaderboard";
import { classService, type ClassItem } from "@/lib/class-service";

export default function LeaderboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    classService.myEnrolledClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Top students in your classes.
      </p>
      <ClassLeaderboard classes={classes.map((c) => ({ id: c.id, title: c.title }))} />
    </div>
  );
}
