"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileIcon, LinkIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { quizService, type Attachment, type SubmissionResult } from "@/lib/quiz-service";

export default function SubmissionsPage() {
  const params = useParams();
  const questId = Number(params.questId);

  const [subs, setSubs] = useState<SubmissionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<SubmissionResult | null>(null);
  const [feedback, setFeedback] = useState("");
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setSubs(await quizService.listSubmissions(questId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (questId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  function openGrade(s: SubmissionResult) {
    setActive(s);
    setFeedback(s.feedback ?? "");
    setScore(s.score);
    setMaxScore(s.max_score);
    const g: Record<number, number> = {};
    s.answers.forEach((a) => (g[a.question_id] = a.awarded_points));
    setGrades(g);
  }

  async function handleGrade() {
    if (!active) return;
    setSaving(true);
    try {
      const hasQuestions = active.answers.length > 0;
      const payload = hasQuestions
        ? {
            feedback,
            answer_grades: active.answers
              .filter((a) => a.is_correct === null) // only manual ones
              .map((a) => ({
                question_id: a.question_id,
                awarded_points: grades[a.question_id] ?? 0,
              })),
          }
        : { feedback, score, max_score: maxScore };
      const updated = await quizService.grade(active.id, payload);
      setSubs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grade");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <h1 className="mb-1 text-2xl font-bold">Submissions</h1>
      <p className="mb-6 text-sm text-muted-foreground">Quest #{questId}</p>
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Student #{s.user_id}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "completed" || s.status === "graded" ? "default" : "secondary"}>
                    {s.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {s.score}/{s.max_score}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {s.attachments.length > 0 && `${s.attachments.length} attachment(s) · `}
                  {s.needs_manual_grading ? "Needs grading" : "Auto-graded"}
                </span>
                <Button size="sm" variant="outline" onClick={() => openGrade(s)}>
                  {s.needs_manual_grading ? "Grade" : "Review"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade submission</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              {active.text_response && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Written response</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{active.text_response}</p>
                </div>
              )}

              {active.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Attachments</p>
                  {active.attachments.map((a, i) => (
                    <AttachmentRow key={a.id ?? i} att={a} />
                  ))}
                </div>
              )}

              {/* Question-based manual grading */}
              {active.answers.length > 0 ? (
                active.answers
                  .filter((a) => a.is_correct === null)
                  .map((a) => (
                    <div key={a.question_id} className="grid gap-2">
                      <Label>
                        Question #{a.question_id} — answer: {a.answer_text || "(none)"}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={grades[a.question_id] ?? 0}
                        onChange={(e) =>
                          setGrades((p) => ({ ...p, [a.question_id]: Number(e.target.value) }))
                        }
                      />
                    </div>
                  ))
              ) : (
                /* Assignment-style: set an overall score */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Score</Label>
                    <Input
                      type="number"
                      min={0}
                      value={score}
                      onChange={(e) => setScore(Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Out of</Label>
                    <Input
                      type="number"
                      min={0}
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label>Feedback</Label>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleGrade} disabled={saving}>
              {saving ? "Saving..." : "Save grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentRow({ att }: { att: Attachment }) {
  const href = att.kind === "file" ? quizService.fileUrl(att.url) : att.url;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent/50"
    >
      {att.kind === "file" ? <FileIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
      <span className="truncate text-primary underline-offset-2 hover:underline">{att.name}</span>
    </a>
  );
}
