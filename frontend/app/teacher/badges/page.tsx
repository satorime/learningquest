"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { classService, type ClassItem, type ClassMember } from "@/lib/class-service";
import type { Badge } from "@/types/badges";
import { cleanError } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BadgeArt,
  BADGE_ICONS,
  BADGE_ICON_OPTIONS,
  BADGE_COLORS,
  BADGE_COLOR_OPTIONS,
  BADGE_SHAPE_OPTIONS,
  type BadgeShape,
} from "@/components/badges/badge-art";
import { Award, Trash2, Gift, Users, Loader2 } from "lucide-react";

interface Recipient {
  user_id: number;
  name: string;
  awarded_at: string | null;
}

export default function TeacherBadgesPage() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "award",
    color: "amber",
    shape: "shield" as BadgeShape,
    exp_value: 50,
  });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [badges, setBadges] = useState<Badge[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Award panel state (per-badge)
  const [awardFor, setAwardFor] = useState<Badge | null>(null);
  const [classId, setClassId] = useState<number | "">("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [studentId, setStudentId] = useState<number | "">("");
  const [awarding, setAwarding] = useState(false);

  // Recipients panel state
  const [recipientsFor, setRecipientsFor] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  const loadBadges = async () => {
    const res = await apiClient.getMyCustomBadges().catch(() => null);
    setBadges(res?.badges ?? []);
  };

  useEffect(() => {
    (async () => {
      try {
        const [, cls] = await Promise.all([
          loadBadges(),
          classService.listMyClasses().catch(() => []),
        ]);
        setClasses(cls);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const students = useMemo(
    () => members.filter((m) => m.role === "student" && m.status === "active"),
    [members]
  );

  const resetForm = () =>
    setForm({ name: "", description: "", icon: "award", color: "amber", shape: "shield", exp_value: 50 });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      await notify({ variant: "error", title: "Name required", description: "Give your badge a name." });
      return;
    }
    const ok = await confirm({
      title: editingId ? "Save changes?" : "Create this badge?",
      description: editingId
        ? `Update "${form.name.trim()}"?`
        : `Create "${form.name.trim()}"?`,
      confirmText: editingId ? "Save" : "Create",
    });
    if (!ok) return;
    try {
      setCreating(true);
      if (editingId) {
        await apiClient.updateCustomBadge(editingId, {
          name: form.name.trim(),
          description: form.description.trim(),
          icon: form.icon,
          color: form.color,
          shape: form.shape,
          exp_value: form.exp_value,
        });
      } else {
        await apiClient.createCustomBadge({
          name: form.name.trim(),
          description: form.description.trim(),
          icon: form.icon,
          color: form.color,
          shape: form.shape,
          exp_value: form.exp_value,
        });
      }
      resetForm();
      setEditingId(null);
      await loadBadges();
      await notify({ variant: "success", description: editingId ? "Badge updated." : "Badge created." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't save the badge.") });
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (b: Badge) => {
    setEditingId(b.badge_id);
    setForm({
      name: b.name,
      description: b.description || "",
      icon: (b.criteria?.icon as string) || "award",
      color: (b.criteria?.color as string) || "amber",
      shape: ((b.criteria?.shape as BadgeShape) || "shield"),
      exp_value: b.exp_value || 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deactivate = async (b: Badge) => {
    const ok = await confirm({
      title: "Deactivate this badge?",
      description: `"${b.name}" will no longer be awardable. Students who already have it keep it.`,
      confirmText: "Deactivate",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.deleteCustomBadge(b.badge_id);
      await loadBadges();
      await notify({ variant: "success", description: "Badge deactivated." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't deactivate the badge.") });
    }
  };

  const openAward = async (b: Badge) => {
    setAwardFor(b);
    setRecipientsFor(null);
    setClassId("");
    setStudentId("");
    setMembers([]);
  };

  const onPickClass = async (id: number) => {
    setClassId(id);
    setStudentId("");
    const m = await classService.listMembers(id).catch(() => []);
    setMembers(m);
  };

  const doAward = async () => {
    if (!awardFor || !studentId) return;
    const studentName =
      students.find((s) => s.user_id === Number(studentId));
    const label = studentName
      ? `${studentName.first_name || ""} ${studentName.last_name || ""}`.trim() ||
        studentName.username
      : "this student";
    const ok = await confirm({
      title: "Award this badge?",
      description: `Give "${awardFor.name}" to ${label}?`,
      confirmText: "Award",
    });
    if (!ok) return;
    try {
      setAwarding(true);
      await apiClient.awardCustomBadge(awardFor.badge_id, Number(studentId), classId ? Number(classId) : undefined);
      setStudentId("");
      await notify({ variant: "success", description: `Awarded "${awardFor.name}".` });
    } catch (e: any) {
      const msg = e?.status === 400 ? "That student already has this badge." : cleanError(e, "Couldn't award the badge.");
      await notify({ variant: "error", description: msg });
    } finally {
      setAwarding(false);
    }
  };

  const openRecipients = async (b: Badge) => {
    setRecipientsFor(b.badge_id);
    setAwardFor(null);
    const res = await apiClient.getBadgeRecipients(b.badge_id).catch(() => null);
    setRecipients(res?.recipients ?? []);
  };

  const revoke = async (badgeId: number, userId: number) => {
    const r = recipients.find((x) => x.user_id === userId);
    const ok = await confirm({
      title: "Revoke this badge?",
      description: `Remove this badge from ${r?.name ?? "this student"}? Any XP it granted will be taken back.`,
      confirmText: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiClient.revokeCustomBadge(badgeId, userId);
      setRecipients((prev) => prev.filter((x) => x.user_id !== userId));
      await notify({ variant: "success", description: "Badge revoked." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't revoke the badge.") });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Badges</h1>
        <p className="text-sm text-muted-foreground">
          Design your own badges and award them to students in your classes. Badges render as
          unique in-app artwork — no images needed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create / edit form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{editingId ? "Edit badge" : "Create a badge"}</CardTitle>
            <CardDescription>Pick a symbol, color and shape.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live preview */}
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 py-4">
              <BadgeArt iconName={form.icon} color={form.color} shape={form.shape} size={84} />
              <span className="text-sm font-medium">{form.name || "Badge preview"}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-name">Name</Label>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Top Performer"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-desc">Description</Label>
              <Textarea
                id="b-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this badge for?"
                rows={2}
              />
            </div>

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {BADGE_ICON_OPTIONS.map((name) => {
                  const Icon = BADGE_ICONS[name];
                  const active = form.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, icon: name })}
                      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                        active ? "border-primary bg-primary/10" : "hover:bg-muted"
                      }`}
                      title={name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {BADGE_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-6 w-6 rounded-full border-2 ${
                      form.color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: BADGE_COLORS[c].dark }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Shape picker */}
            <div className="space-y-1.5">
              <Label>Shape</Label>
              <div className="flex gap-2">
                {BADGE_SHAPE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, shape: s })}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-md border py-2 text-xs capitalize transition-colors ${
                      form.shape === s ? "border-primary bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <BadgeArt iconName={form.icon} color={form.color} shape={s} size={36} />
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-xp">XP reward</Label>
              <Input
                id="b-xp"
                type="number"
                min={0}
                value={form.exp_value}
                onChange={(e) => setForm({ ...form, exp_value: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={creating} className="flex-1">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save changes" : "Create badge"}
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* My badges */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My badges</CardTitle>
            <CardDescription>Award badges to students or manage recipients.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-10 text-center text-muted-foreground">Loading…</p>
            ) : badges.filter((b) => b.is_active).length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No badges yet — create one on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {badges
                  .filter((b) => b.is_active)
                  .map((b) => (
                    <div key={b.badge_id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <BadgeArt
                          iconName={(b.criteria?.icon as string) || "award"}
                          color={(b.criteria?.color as string) || "amber"}
                          shape={(b.criteria?.shape as BadgeShape) || "shield"}
                          size={52}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{b.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {b.description || "—"}
                          </div>
                          <div className="text-xs text-amber-600">+{b.exp_value} XP</div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" onClick={() => openAward(b)}>
                            <Gift className="mr-1 h-3.5 w-3.5" /> Award
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openRecipients(b)}>
                            <Users className="mr-1 h-3.5 w-3.5" /> Recipients
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deactivate(b)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {/* Award panel */}
                      {awardFor?.badge_id === b.badge_id && (
                        <div className="mt-3 grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto]">
                          <select
                            value={classId}
                            onChange={(e) => onPickClass(Number(e.target.value))}
                            className="rounded-md border bg-background px-3 py-1.5 text-sm"
                          >
                            <option value="">Select class…</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                          <select
                            value={studentId}
                            onChange={(e) => setStudentId(Number(e.target.value))}
                            disabled={!classId}
                            className="rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                          >
                            <option value="">
                              {!classId ? "Pick a class first" : students.length ? "Select student…" : "No students"}
                            </option>
                            {students.map((s) => (
                              <option key={s.user_id} value={s.user_id}>
                                {`${s.first_name || ""} ${s.last_name || ""}`.trim() || s.username}
                              </option>
                            ))}
                          </select>
                          <Button onClick={doAward} disabled={!studentId || awarding}>
                            {awarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}

                      {/* Recipients panel */}
                      {recipientsFor === b.badge_id && (
                        <div className="mt-3 rounded-md border bg-muted/30 p-3">
                          {recipients.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No one has this badge yet.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {recipients.map((r) => (
                                <li key={r.user_id} className="flex items-center justify-between text-sm">
                                  <span>{r.name}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => revoke(b.badge_id, r.user_id)}
                                  >
                                    Revoke
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
