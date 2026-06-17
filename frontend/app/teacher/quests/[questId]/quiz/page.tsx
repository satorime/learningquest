"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  quizService,
  type QuizQuestion,
  type QuestionType,
  type QuestionInput,
} from "@/lib/quiz-service";
import { cleanError } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { QuizImportDialog } from "@/components/teacher/quiz-import-dialog";

const emptyOptions = () => [
  { text: "", is_correct: false },
  { text: "", is_correct: false },
];

export default function QuizBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const questId = Number(params.questId);
  const confirm = useConfirm();
  const notify = useNotify();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<string>("");

  // new-question form state
  const [type, setType] = useState<QuestionType>("multiple_choice");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState(emptyOptions());
  const [tfCorrect, setTfCorrect] = useState<"true" | "false">("true");
  const [shortAnswer, setShortAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setQuestions(await quizService.listQuestions(questId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (questId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  function resetForm() {
    setPrompt("");
    setPoints(1);
    setOptions(emptyOptions());
    setTfCorrect("true");
    setShortAnswer("");
  }

  async function handleAdd() {
    if (!prompt.trim()) return;
    setSaving(true);
    setError("");
    const payload: QuestionInput = {
      type,
      prompt,
      points,
      position: questions.length,
    };
    if (type === "multiple_choice") {
      payload.options = options
        .filter((o) => o.text.trim())
        .map((o) => ({ text: o.text, is_correct: o.is_correct }));
      if (!payload.options.some((o) => o.is_correct)) {
        setError("Mark at least one correct option.");
        setSaving(false);
        return;
      }
    } else if (type === "true_false") {
      payload.options = [
        { text: "True", is_correct: tfCorrect === "true" },
        { text: "False", is_correct: tfCorrect === "false" },
      ];
    } else {
      payload.correct_answer = shortAnswer.trim() || null;
    }
    try {
      await quizService.addQuestion(questId, payload);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add question");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirm({
      title: "Delete this question?",
      description: "This can't be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await quizService.deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      await notify({ variant: "success", description: "Question deleted." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't delete the question.") });
    }
  }

  async function handlePublish() {
    const ok = await confirm({
      title: "Publish this quiz?",
      description: "Students in the class will be able to take it.",
      confirmText: "Publish",
    });
    if (!ok) return;
    setError("");
    try {
      const res = await quizService.publish(questId);
      setStatus(res.status);
      if (res.status === "published") {
        await notify({ variant: "success", description: "Quiz published." });
        router.push("/teacher/dashboard");
      }
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Failed to publish the quiz.") });
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Quiz Builder</h1>
          <p className="text-sm text-muted-foreground">Quest #{questId}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status && <Badge variant="secondary">{status}</Badge>}
          <Button onClick={handlePublish} disabled={questions.length === 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {/* existing questions */}
      <div className="mb-8 space-y-3">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-muted-foreground">No questions yet.</p>
        ) : (
          questions.map((q, i) => (
            <Card key={q.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  {i + 1}. {q.prompt}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{q.type.replace("_", " ")}</Badge>
                  <Badge>{q.points} pt</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => handleDelete(q.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {q.type === "short_answer" ? (
                  <span>Answer: {q.correct_answer || "(manually graded)"}</span>
                ) : (
                  <ul className="list-inside list-disc">
                    {q.options.map((o) => (
                      <li key={o.id} className={o.is_correct ? "text-green-600" : ""}>
                        {o.text} {o.is_correct ? "✓" : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* new question form */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Add a question</CardTitle>
            <QuizImportDialog questId={questId} onImported={load} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Points</Label>
              <Input type="number" min={0} value={points}
                onChange={(e) => setPoints(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </div>

          {type === "multiple_choice" && (
            <div className="space-y-2">
              <Label>Options (check the correct one)</Label>
              {options.map((o, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="checkbox" checked={o.is_correct}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, is_correct: e.target.checked } : x
                        )
                      )
                    } />
                  <Input value={o.text} placeholder={`Option ${idx + 1}`}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, text: e.target.value } : x
                        )
                      )
                    } />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setOptions((prev) => [...prev, { text: "", is_correct: false }])}>
                <Plus className="mr-2 h-4 w-4" /> Add option
              </Button>
            </div>
          )}

          {type === "true_false" && (
            <div className="grid gap-2">
              <Label>Correct answer</Label>
              <Select value={tfCorrect} onValueChange={(v) => setTfCorrect(v as "true" | "false")}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "short_answer" && (
            <div className="grid gap-2">
              <Label>Accepted answer (leave blank to grade manually)</Label>
              <Input value={shortAnswer} onChange={(e) => setShortAnswer(e.target.value)} />
            </div>
          )}

          <Button onClick={handleAdd} disabled={saving || !prompt.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Adding..." : "Add question"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
