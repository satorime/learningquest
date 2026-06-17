"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw, Users, Plus, Archive } from "lucide-react";
import {
  classService,
  type ClassItem,
  type ClassMember,
} from "@/lib/class-service";
import { cleanError } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";

export default function TeacherClassesPage() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState<ClassMember[] | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassItem | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setClasses(await classService.listMyClasses(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    const ok = await confirm({
      title: "Create this class?",
      description: `Create "${title.trim()}"?`,
      confirmText: "Create",
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      await classService.createClass({ title, description });
      setTitle("");
      setDescription("");
      setCreateOpen(false);
      await load();
      await notify({ variant: "success", description: "Class created." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Failed to create class.") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerate(c: ClassItem) {
    const ok = await confirm({
      title: "Regenerate the join code?",
      description: `The current code for "${c.title}" will stop working. Students who haven't joined will need the new code.`,
      confirmText: "Regenerate",
      destructive: true,
    });
    if (!ok) return;
    try {
      const updated = await classService.regenerateCode(c.id);
      setClasses((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      await notify({ variant: "success", description: "New join code generated." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't regenerate the code.") });
    }
  }

  async function handleArchiveToggle(c: ClassItem) {
    const archiving = c.is_active;
    const ok = await confirm({
      title: archiving ? "Archive this class?" : "Unarchive this class?",
      description: archiving
        ? `"${c.title}" will be hidden and students can no longer join.`
        : `"${c.title}" will be active again.`,
      confirmText: archiving ? "Archive" : "Unarchive",
      destructive: archiving,
    });
    if (!ok) return;
    try {
      const updated = await classService.updateClass(c.id, { is_active: !c.is_active });
      setClasses((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      await notify({ variant: "success", description: archiving ? "Class archived." : "Class unarchived." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't update the class.") });
    }
  }

  async function openMembers(c: ClassItem) {
    setActiveClass(c);
    setMembers(null);
    setMembersOpen(true);
    setMembers(await classService.listMembers(c.id));
  }

  async function handleRemoveMember(userId: number) {
    if (!activeClass) return;
    const m = members?.find((x) => x.user_id === userId);
    const label = m
      ? `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username
      : "this student";
    const ok = await confirm({
      title: "Remove this student?",
      description: `Remove ${label} from "${activeClass.title}"?`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await classService.removeMember(activeClass.id, userId);
      setMembers((prev) => prev?.filter((m) => m.user_id !== userId) ?? null);
      await notify({ variant: "success", description: "Student removed." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't remove the student.") });
    }
  }

  function copyCode(code?: string | null) {
    if (code) navigator.clipboard?.writeText(code);
  }

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">My Classes</h1>
          <p className="text-sm text-muted-foreground">
            Create classes and share a join code with your students.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a class</DialogTitle>
              <DialogDescription>
                Students will join using a generated code.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={submitting || !title.trim()}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-muted-foreground">No classes yet. Create your first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id} className={c.is_active ? "" : "opacity-60"}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  {!c.is_active && <Badge variant="secondary">Archived</Badge>}
                </div>
                {c.description && <CardDescription>{c.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Join code:</span>
                  <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
                    {c.join_code}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => copyCode(c.join_code)} title="Copy">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => handleRegenerate(c)} title="Regenerate">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {c.member_count} student
                  {c.member_count === 1 ? "" : "s"}
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => openMembers(c)}>
                  <Users className="mr-2 h-4 w-4" /> Roster
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleArchiveToggle(c)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {c.is_active ? "Archive" : "Unarchive"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeClass?.title} — Roster</DialogTitle>
          </DialogHeader>
          {members === null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground">No students yet.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {`${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.username}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {m.role === "student" && (
                    <Button variant="ghost" size="sm"
                      onClick={() => handleRemoveMember(m.user_id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
