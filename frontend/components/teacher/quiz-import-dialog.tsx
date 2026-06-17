"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUp, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import {
  quizService,
  type QuestionInput,
  type QuestionType,
} from "@/lib/quiz-service";
import { cleanError } from "@/lib/api-client";
import { useNotify } from "@/components/ui/notify-dialog";

type Draft = Required<Pick<QuestionInput, "type" | "prompt" | "points">> & {
  correct_answer?: string | null;
  options: { text: string; is_correct: boolean }[];
};

function toDraft(q: QuestionInput): Draft {
  return {
    type: q.type,
    prompt: q.prompt ?? "",
    points: q.points ?? 1,
    correct_answer: q.correct_answer ?? "",
    options: (q.options ?? []).map((o) => ({ text: o.text, is_correct: !!o.is_correct })),
  };
}

export function QuizImportDialog({
  questId,
  onImported,
}: {
  questId: number;
  onImported: () => void | Promise<void>;
}) {
  const notify = useNotify();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const res = await quizService.importQuestions(questId, file);
      const list = (res.questions ?? []).map(toDraft);
      if (list.length === 0) {
        await notify({ variant: "error", description: "No questions were detected in that file." });
        return;
      }
      setDrafts(list);
      setOpen(true);
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't read that file.") });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const updateOption = (qi: number, oi: number, patch: Partial<Draft["options"][number]>) =>
    setDrafts((prev) =>
      prev.map((d, idx) =>
        idx === qi
          ? { ...d, options: d.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : d
      )
    );

  const addOption = (qi: number) =>
    update(qi, { options: [...drafts[qi].options, { text: "", is_correct: false }] });

  const removeOption = (qi: number, oi: number) =>
    update(qi, { options: drafts[qi].options.filter((_, j) => j !== oi) });

  const removeDraft = (qi: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== qi));

  const setType = (qi: number, type: QuestionType) => {
    const d = drafts[qi];
    let options = d.options;
    if (type === "true_false") {
      const trueCorrect = d.options.find((o) => /^true$/i.test(o.text))?.is_correct ?? true;
      options = [
        { text: "True", is_correct: trueCorrect },
        { text: "False", is_correct: !trueCorrect },
      ];
    } else if (type === "multiple_choice" && options.length < 2) {
      options = [
        { text: "", is_correct: true },
        { text: "", is_correct: false },
      ];
    }
    update(qi, { type, options });
  };

  function validate(): string | null {
    for (const [i, d] of drafts.entries()) {
      if (!d.prompt.trim()) return `Question ${i + 1} has no prompt.`;
      if (d.type === "multiple_choice") {
        const opts = d.options.filter((o) => o.text.trim());
        if (opts.length < 2) return `Question ${i + 1} needs at least 2 options.`;
        if (!opts.some((o) => o.is_correct)) return `Question ${i + 1} has no correct option marked.`;
      }
    }
    return null;
  }

  async function save() {
    const err = validate();
    if (err) {
      await notify({ variant: "error", description: err });
      return;
    }
    setSaving(true);
    try {
      const payload: QuestionInput[] = drafts.map((d) => ({
        type: d.type,
        prompt: d.prompt.trim(),
        points: Math.max(1, d.points || 1),
        correct_answer: d.type === "short_answer" ? (d.correct_answer || "").trim() || null : null,
        options:
          d.type === "short_answer"
            ? []
            : d.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })),
      }));
      await quizService.addQuestionsBulk(questId, payload);
      setOpen(false);
      setDrafts([]);
      await onImported();
      await notify({ variant: "success", description: `Added ${payload.length} question${payload.length > 1 ? "s" : ""}.` });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't add the questions.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
        {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Import from PDF/Word
      </Button>

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" /> Review detected questions
            </DialogTitle>
            <DialogDescription>
              We extracted {drafts.length} question{drafts.length === 1 ? "" : "s"}. Check and fix
              anything, then add them to the quiz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {drafts.map((d, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                  <Textarea
                    value={d.prompt}
                    onChange={(e) => update(i, { prompt: e.target.value })}
                    rows={2}
                    className="flex-1"
                    placeholder="Question prompt"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeDraft(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <Select value={d.type} onValueChange={(v) => setType(i, v as QuestionType)}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                      <SelectItem value="true_false">True / False</SelectItem>
                      <SelectItem value="short_answer">Short answer</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Points</Label>
                    <Input
                      type="number"
                      min={1}
                      value={d.points}
                      onChange={(e) => update(i, { points: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16"
                    />
                  </div>
                </div>

                {/* Options / answer editor */}
                {d.type === "short_answer" ? (
                  <div className="pl-6">
                    <Label className="text-xs text-muted-foreground">Accepted answer (optional)</Label>
                    <Input
                      value={d.correct_answer ?? ""}
                      onChange={(e) => update(i, { correct_answer: e.target.value })}
                      placeholder="Leave blank to grade manually"
                    />
                  </div>
                ) : (
                  <div className="space-y-2 pl-6">
                    {d.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Checkbox
                          checked={o.is_correct}
                          onCheckedChange={(c) => {
                            if (d.type === "true_false") {
                              // exactly one correct
                              update(i, {
                                options: d.options.map((opt, j) => ({ ...opt, is_correct: j === oi })),
                              });
                            } else {
                              updateOption(i, oi, { is_correct: !!c });
                            }
                          }}
                        />
                        <Input
                          value={o.text}
                          onChange={(e) => updateOption(i, oi, { text: e.target.value })}
                          disabled={d.type === "true_false"}
                          placeholder={`Option ${oi + 1}`}
                        />
                        {d.type === "multiple_choice" && d.options.length > 2 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOption(i, oi)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {d.type === "multiple_choice" && (
                      <Button variant="ghost" size="sm" onClick={() => addOption(i)}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">Tick the correct answer(s).</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || drafts.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {drafts.length} question{drafts.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
