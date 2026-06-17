"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Paperclip, LinkIcon, FileIcon, X, Upload, Clock, CalendarClock } from "lucide-react";
import {
  quizService,
  type QuizQuestion,
  type AnswerInput,
  type Attachment,
  type QuestInfo,
  type SubmissionResult,
} from "@/lib/quiz-service";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { cleanError, isApiError } from "@/lib/api-client";

const timerKey = (questId: number) => `quiz_timer_${questId}`;

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TakeQuizPage() {
  const params = useParams();
  const questId = Number(params.questId);
  const confirm = useConfirm();
  const notify = useNotify();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerInput>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [textResponse, setTextResponse] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [info, setInfo] = useState<QuestInfo | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSubmittedRef = useRef(false);
  const handleSubmitRef = useRef<() => void>(() => {});

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Always load the questions (so resubmits can edit answers too).
      const qs = await quizService.take(questId).catch(() => []);
      setQuestions(qs);
      setInfo(await quizService.questInfo(questId).catch(() => null));
      try {
        const existing = await quizService.mySubmission(questId);
        setResult(existing);
      } catch {
        /* no submission yet */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (questId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  function setOption(qid: number, optionId: number) {
    setAnswers((p) => ({ ...p, [qid]: { question_id: qid, selected_option_id: optionId } }));
  }
  function setText(qid: number, text: string) {
    setAnswers((p) => ({ ...p, [qid]: { question_id: qid, answer_text: text } }));
  }

  // Prefill the editor from an existing submission.
  function startEditing(sub: SubmissionResult) {
    const prefilled: Record<number, AnswerInput> = {};
    for (const a of sub.answers) {
      prefilled[a.question_id] = {
        question_id: a.question_id,
        selected_option_id: a.selected_option_id ?? undefined,
        answer_text: a.answer_text ?? undefined,
      };
    }
    setAnswers(prefilled);
    setAttachments(sub.attachments ?? []);
    setTextResponse(sub.text_response ?? "");
    setEditing(true);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const att = await quizService.uploadFile(questId, file);
        setAttachments((prev) => [...prev, att]);
      }
    } catch (e) {
      // 409 = the class teacher hasn't connected Google Drive yet.
      const msg = isApiError(e, 409)
        ? e.message
        : e instanceof Error
        ? e.message
        : "Upload failed";
      setError(msg);
      await notify({ variant: "error", description: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    setAttachments((prev) => [
      ...prev,
      { kind: "link", url: withProto, name: linkName.trim() || withProto },
    ]);
    setLinkUrl("");
    setLinkName("");
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await quizService.submit(questId, {
        answers: Object.values(answers),
        text_response: textResponse.trim() || undefined,
        attachments,
      });
      localStorage.removeItem(timerKey(questId)); // stop the countdown
      setResult(res);
      setEditing(false);
      await notify({ variant: "success", title: "Submitted", description: "Your answers were submitted." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      await notify({ variant: "error", description: cleanError(e, "Failed to submit your answers.") });
    } finally {
      setSubmitting(false);
    }
  }

  // Confirm before a manual submit (the timer's auto-submit calls handleSubmit
  // directly, with no prompt).
  async function handleSubmitClick() {
    const ok = await confirm({
      title: "Submit your answers?",
      description: "You can edit your submission until the deadline.",
      confirmText: "Submit",
    });
    if (ok) await handleSubmit();
  }

  // Keep the interval's reference to handleSubmit fresh (avoids stale state).
  handleSubmitRef.current = handleSubmit;

  // Countdown for a timed quiz that hasn't been submitted yet. The start time
  // is persisted so a refresh resumes the same countdown instead of restarting.
  useEffect(() => {
    const limit = info?.time_limit_minutes;
    if (!limit || result || loading) {
      setRemainingMs(null);
      return;
    }
    const key = timerKey(questId);
    let start = Number(localStorage.getItem(key));
    if (!start) {
      start = Date.now();
      localStorage.setItem(key, String(start));
    }
    const endAt = start + limit * 60_000;

    const tick = () => {
      const rem = endAt - Date.now();
      setRemainingMs(Math.max(0, rem));
      if (rem <= 0) {
        clearInterval(id);
        if (!autoSubmittedRef.current) {
          autoSubmittedRef.current = true;
          handleSubmitRef.current(); // time's up — auto-submit
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, result, loading, questId]);

  async function handleUnsubmit() {
    const ok = await confirm({
      title: "Withdraw your submission?",
      description: "Your work will be returned to you. You can submit again before the deadline.",
      confirmText: "Unsubmit",
      destructive: true,
    });
    if (!ok) return;
    setSubmitting(true);
    setError("");
    try {
      await quizService.unsubmit(questId);
      localStorage.removeItem(timerKey(questId)); // fresh countdown on retake
      autoSubmittedRef.current = false;
      setResult(null);
      setAnswers({});
      setAttachments([]);
      setTextResponse("");
      setEditing(false);
      await load();
      await notify({ variant: "success", description: "Submission withdrawn. You can edit and submit again." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to withdraw");
      await notify({ variant: "error", description: cleanError(e, "Failed to withdraw your submission.") });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-8 text-muted-foreground">Loading…</p>;

  // --- Result view (submitted, not editing) ---------------------------------
  if (result && !editing) {
    const canEdit = result.status === "submitted"; // not yet teacher-graded
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your submission</span>
              <Badge variant={result.status === "completed" || result.status === "graded" ? "default" : "secondary"}>
                {result.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.needs_manual_grading && result.status === "submitted" ? (
              <p className="text-muted-foreground">
                Turned in! Awaiting your teacher&apos;s review.
              </p>
            ) : (
              <p className="text-lg font-semibold">
                Score: {result.score} / {result.max_score}
              </p>
            )}

            {result.text_response && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="mb-1 font-medium">Your response</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{result.text_response}</p>
              </div>
            )}

            {result.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Attachments</p>
                {result.attachments.map((a, i) => (
                  <AttachmentRow key={a.id ?? i} att={a} />
                ))}
              </div>
            )}

            {result.feedback && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Teacher feedback</p>
                <p className="text-muted-foreground">{result.feedback}</p>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => startEditing(result)}>
                  Edit submission
                </Button>
                <Button variant="ghost" onClick={handleUnsubmit} disabled={submitting}>
                  Unsubmit
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Submit / edit form ---------------------------------------------------
  const lowTime = remainingMs !== null && remainingMs < 60_000;
  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{info?.title ?? (editing ? "Edit submission" : "Submit your work")}</h1>
        {remainingMs !== null && (
          <Badge
            variant={lowTime ? "destructive" : "secondary"}
            className="text-sm tabular-nums"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            {formatMs(remainingMs)} left
          </Badge>
        )}
      </div>

      {info?.description && (
        <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {info.description}
        </p>
      )}
      {info?.end_date && (
        <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Due {new Date(info.end_date).toLocaleString()}
        </p>
      )}
      {remainingMs !== null && (
        <p className="mb-4 text-xs text-muted-foreground">
          This quiz has a {info?.time_limit_minutes}-minute time limit. It will submit
          automatically when the timer reaches zero.
        </p>
      )}
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {/* Questions (if any) */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {i + 1}. {q.prompt}{" "}
                <span className="text-xs font-normal text-muted-foreground">({q.points} pt)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.type === "short_answer" ? (
                <Input
                  placeholder="Your answer"
                  value={answers[q.id]?.answer_text ?? ""}
                  onChange={(e) => setText(q.id, e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id]?.selected_option_id === o.id}
                        onChange={() => setOption(q.id, o.id!)}
                      />
                      {o.text}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attachments / response */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" /> Your work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Text response</label>
            <Textarea
              placeholder="Write your answer or notes (optional)…"
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
            />
          </div>

          {/* Existing attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {a.kind === "file" ? (
                      <FileIcon className="h-4 w-4 shrink-0" />
                    ) : (
                      <LinkIcon className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{a.name}</span>
                  </span>
                  <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : "Add files"}
            </Button>
          </div>

          {/* Add link */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1.5" style={{ minWidth: "12rem" }}>
              <label className="text-sm font-medium">Add a link</label>
              <Input
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <Input
              placeholder="Label (optional)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="flex-1"
              style={{ minWidth: "10rem" }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
              <LinkIcon className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button onClick={handleSubmitClick} disabled={submitting || uploading}>
          {submitting ? "Submitting…" : editing ? "Resubmit" : "Submit"}
        </Button>
        {editing && (
          <Button variant="ghost" onClick={() => { setEditing(false); setError(""); }}>
            Cancel
          </Button>
        )}
      </div>
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
