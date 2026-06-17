"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, LogIn } from "lucide-react";
import { classService, type ClassItem } from "@/lib/class-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { cleanError } from "@/lib/api-client";

export default function StudentClassesPage() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      setClasses(await classService.myEnrolledClasses());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleJoin() {
    if (!code.trim()) return;
    setJoining(true);
    setError("");
    setMessage("");
    try {
      const joined = await classService.joinClass(code.trim());
      setCode("");
      await load();
      await notify({ variant: "success", description: `Joined "${joined.title}".` });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Could not join class.") });
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(id: number) {
    const cls = classes.find((c) => c.id === id);
    const ok = await confirm({
      title: "Leave this class?",
      description: cls
        ? `You'll be unenrolled from "${cls.title}" and lose access to its quizzes.`
        : "You'll be unenrolled from this class.",
      confirmText: "Leave",
      destructive: true,
    });
    if (!ok) return;
    try {
      await classService.leaveClass(id);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      await notify({ variant: "success", description: "You left the class." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Could not leave the class.") });
    }
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="mb-1 text-2xl font-bold">My Classes</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Join a class with the code your teacher gave you.
      </p>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Enter class code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="max-w-xs font-mono"
        />
        <Button onClick={handleJoin} disabled={joining || !code.trim()}>
          <LogIn className="mr-2 h-4 w-4" />
          {joining ? "Joining..." : "Join"}
        </Button>
      </div>
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}
      {message && <div className="mb-4 text-sm text-green-600">{message}</div>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-muted-foreground">
          You haven&apos;t joined any classes yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-lg">{c.title}</CardTitle>
                {c.description && <CardDescription>{c.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {c.member_count} classmate
                  {c.member_count === 1 ? "" : "s"}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" size="sm" onClick={() => handleLeave(c.id)}>
                  Leave class
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
