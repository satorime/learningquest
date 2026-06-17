"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  adminService,
  type AdminUser,
  type PlatformStats,
} from "@/lib/admin-service";
import { cleanError } from "@/lib/api-client";
import { useConfirm, type ConfirmOptions } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";

const roleBadge: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  teacher: "secondary",
  student: "outline",
};

export default function AdminDashboard() {
  const { logout } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  // create-teacher dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", username: "", email: "", password: "", role: "teacher",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, u] = await Promise.all([
        adminService.stats(),
        adminService.listUsers({
          role: roleFilter === "all" ? undefined : roleFilter,
          q: query || undefined,
        }),
      ]);
      setStats(s);
      setUsers(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTeacher() {
    const ok = await confirm({
      title: "Create this account?",
      description: `Provision a ${form.role} account for ${form.first_name} ${form.last_name}?`,
      confirmText: "Create",
    });
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      await adminService.createUser(form);
      setOpen(false);
      setForm({ first_name: "", last_name: "", username: "", email: "", password: "", role: "teacher" });
      await load();
      await notify({ variant: "success", description: "Account created." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Failed to create the account.") });
    } finally {
      setSaving(false);
    }
  }

  // Run a user-mutating admin action behind a confirm dialog + result popup.
  async function act(
    factory: () => Promise<AdminUser>,
    opts: { confirm: ConfirmOptions; successMsg: string }
  ) {
    const ok = await confirm(opts.confirm);
    if (!ok) return;
    try {
      const updated = await factory();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      await notify({ variant: "success", description: opts.successMsg });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Action failed.") });
    }
  }

  const statCards = stats
    ? [
        { label: "Total users", value: stats.total_users },
        { label: "Students", value: stats.students },
        { label: "Teachers", value: stats.teachers },
        { label: "Active", value: stats.active_users },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">LearningQuest Admin</h1>
          <p className="text-sm text-muted-foreground">User management</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" /> Create teacher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create an account</DialogTitle>
              <DialogDescription>Provision a teacher (or another role).</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>First name</Label>
                  <Input value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Last name</Label>
                  <Input value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Username</Label>
                <Input value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Temporary password</Label>
                <Input type="text" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createTeacher}
                disabled={saving || !form.username || !form.email || form.password.length < 8}>
                {saving ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search name / email / username" value={query}
          onChange={(e) => setQuery(e.target.value)} className="max-w-xs" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="teacher">Teachers</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {/* users table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-muted-foreground">No users found.</p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.username}
                      {!u.is_active && (
                        <span className="ml-2 text-xs text-red-500">(deactivated)</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant={roleBadge[u.role] || "outline"}>{u.role}</Badge>
                    {u.role === "student" && (
                      <Button size="sm" variant="outline" onClick={() => act(
                        () => adminService.promote(u.id),
                        {
                          confirm: {
                            title: "Make this user a teacher?",
                            description: `${u.username} will gain teacher permissions.`,
                            confirmText: "Make teacher",
                          },
                          successMsg: `${u.username} is now a teacher.`,
                        },
                      )}>
                        Make teacher
                      </Button>
                    )}
                    {u.role === "teacher" && (
                      <Button size="sm" variant="outline" onClick={() => act(
                        () => adminService.demote(u.id),
                        {
                          confirm: {
                            title: "Make this user a student?",
                            description: `${u.username} will lose teacher permissions.`,
                            confirmText: "Make student",
                            destructive: true,
                          },
                          successMsg: `${u.username} is now a student.`,
                        },
                      )}>
                        Make student
                      </Button>
                    )}
                    {u.role !== "admin" &&
                      (u.is_active ? (
                        <Button size="sm" variant="ghost" onClick={() => act(
                          () => adminService.deactivate(u.id),
                          {
                            confirm: {
                              title: "Deactivate this account?",
                              description: `${u.username} will no longer be able to sign in.`,
                              confirmText: "Deactivate",
                              destructive: true,
                            },
                            successMsg: `${u.username} deactivated.`,
                          },
                        )}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => act(
                          () => adminService.activate(u.id),
                          {
                            confirm: {
                              title: "Reactivate this account?",
                              description: `${u.username} will be able to sign in again.`,
                              confirmText: "Activate",
                            },
                            successMsg: `${u.username} reactivated.`,
                          },
                        )}>
                          Activate
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
