"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Flame, Clock, Sparkles, Trophy, GraduationCap, ArrowRight } from "lucide-react";
import { gamesService, type StartResponse, type FinishResponse } from "@/lib/games-service";

type Phase = "intro" | "playing" | "finished";
type PetMood = "idle" | "happy" | "sad" | "celebrate";

const PET_GIF: Record<PetMood, string> = {
  idle: "/animations/Chilling.gif",
  happy: "/animations/Happy.gif",
  sad: "/animations/Crying.gif",
  celebrate: "/animations/Dancing.gif",
};

const CHEERS = ["Nice! 🎉", "Yum! 😋", "Brilliant! ✨", "On a roll!", "Pet loves it! 🍖", "Sharp! 🧠"];
const TREATS = ["🍖", "🐟", "🍗", "🦴", "🍤"];

interface Reveal {
  correct: boolean;
  correctValue: string | null;
  chosen: string | null;
  solution: string;
}

export default function PetFeastPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<StartResponse | null>(null);
  const [current, setCurrent] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [pet, setPet] = useState<PetMood>("idle");
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pointsPop, setPointsPop] = useState<number | null>(null);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [result, setResult] = useState<FinishResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = useRef(false);
  const pendingHearts = useRef(3);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const problems = session?.problems ?? [];
  const total = problems.length;
  const problem = problems[current];
  const progressPct = total ? Math.round((current / total) * 100) : 0;

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const s = await gamesService.startMath();
      setSession(s);
      setCurrent(0);
      setHearts(3);
      pendingHearts.current = 3;
      setCombo(0);
      setBestCombo(0);
      setScore(0);
      setPet("idle");
      setReveal(null);
      setResult(null);
      setTimeLeft(s.seconds_per_question);
      locked.current = false;
      setPhase("playing");
    } finally {
      setBusy(false);
    }
  }, []);

  const finish = useCallback(async (sid: number) => {
    setPhase("finished");
    try {
      const r = await gamesService.finishMath(sid);
      setResult(r);
      setPet(r.correct >= Math.ceil(r.total / 2) ? "celebrate" : "sad");
      window.dispatchEvent(new Event("pet:food-changed"));
    } catch {
      /* ignore */
    }
  }, []);

  const goNext = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setReveal(null);
    setPointsPop(null);
    setMilestone(null);
    locked.current = false;
    if (!session) return;
    if (pendingHearts.current <= 0 || current + 1 >= total) {
      finish(session.session_id);
      return;
    }
    setCurrent((c) => c + 1);
    setPet("idle");
    setTimeLeft(session.seconds_per_question);
  }, [session, current, total, finish]);

  const doReveal = useCallback(
    (correct: boolean, correctValue: string | null, chosen: string | null, solution: string) => {
      if (correct) {
        setCombo((c) => {
          const nc = c + 1;
          setBestCombo((b) => Math.max(b, nc));
          const pts = 10 + c * 2;
          setScore((s) => s + pts);
          setPointsPop(pts);
          if (nc >= 3) setMilestone(`🔥 ${nc}x streak!`);
          return nc;
        });
        setPet("happy");
      } else {
        const nh = hearts - 1;
        setHearts(nh);
        pendingHearts.current = nh;
        setCombo(0);
        setPet("sad");
      }
      setReveal({ correct, correctValue, chosen, solution });
      // Correct answers flow on automatically; wrong ones wait so the student
      // can read the solution.
      if (correct) {
        autoTimer.current = setTimeout(goNext, 2600);
      }
    },
    [hearts, goNext]
  );

  const submit = useCallback(
    async (value: string) => {
      if (!session || locked.current) return;
      locked.current = true;
      try {
        const res = await gamesService.answerMath(session.session_id, current, value);
        doReveal(res.correct, res.correct_value, value === "" ? null : value, res.solution);
      } catch {
        doReveal(false, null, value === "" ? null : value, "");
      }
    },
    [session, current, doReveal]
  );

  // Per-question countdown; a time-out submits an empty answer (counts wrong,
  // but still fetches the solution to teach).
  useEffect(() => {
    if (phase !== "playing" || reveal || locked.current) return;
    if (timeLeft <= 0) {
      submit("");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, reveal, timeLeft, submit]);

  // --- intro ---------------------------------------------------------------
  if (phase === "intro") {
    return (
      <div className="container mx-auto max-w-xl px-4 py-10">
        <Button variant="ghost" size="sm" onClick={() => router.push("/student/quests")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quests
        </Button>
        <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/10 p-8 text-center shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PET_GIF.idle} alt="Pet" width={130} height={130} className="mx-auto" />
          <h1 className="mt-2 text-3xl font-extrabold">🍖 Pet Feast</h1>
          <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Senior High Math · Grade 11–12
          </p>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Solve to feed your pet! Every answer shows you <strong>how it&apos;s solved</strong>, so you
            learn as you play. 3 hearts, build combos for bonus points, and earn{" "}
            <strong>food + XP</strong>.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            {["Functions", "Quadratics", "Logarithms", "Trigonometry", "Calculus", "Probability"].map((t) => (
              <span key={t} className="rounded-full bg-muted px-2.5 py-1">{t}</span>
            ))}
          </div>
          <Button size="lg" className="mt-6" onClick={start} disabled={busy}>
            {busy ? "Loading…" : "Start Feeding"}
          </Button>
        </div>
      </div>
    );
  }

  // --- finished ------------------------------------------------------------
  if (phase === "finished") {
    const good = result ? result.correct >= Math.ceil(result.total / 2) : false;
    return (
      <div className="container mx-auto max-w-xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/10 p-8 text-center shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PET_GIF[good ? "celebrate" : "sad"]} alt="Pet" width={130} height={130} className="mx-auto" />
          <h2 className="mt-2 text-2xl font-bold">
            {good ? "Your pet is full and happy! 🎉" : "Good effort — keep practicing!"}
          </h2>
          {result && (
            <>
              <p className="mt-2 text-lg">
                Score: <span className="font-bold">{result.correct}</span> / {result.total}
                {bestCombo >= 2 && <span className="ml-2 text-sm text-orange-500">· best combo {bestCombo}x</span>}
              </p>
              <div className="mt-1 text-3xl font-extrabold text-primary">{score} pts</div>
              <div className="mt-3 flex items-center justify-center gap-4 text-lg font-semibold">
                <span>🍖 +{result.food_awarded} food</span>
                <span className="text-amber-600 dark:text-amber-400">+{result.xp_awarded} XP</span>
              </div>
              {result.food_awarded === 0 && result.xp_awarded === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.correct === 0
                    ? "No correct answers this round — give it another go!"
                    : "You've hit today's game reward limit — keep playing for practice!"}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Earned from {result.correct} correct {result.correct === 1 ? "answer" : "answers"}.
                </p>
              )}
            </>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={start} disabled={busy}>Play Again</Button>
            <Button variant="outline" onClick={() => router.push("/student/quests")}>Back to Quests</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- playing -------------------------------------------------------------
  const choiceClass = (value: string): string => {
    if (!reveal) return "border bg-card hover:border-primary hover:bg-accent";
    if (reveal.correctValue !== null && value === reveal.correctValue) {
      return "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    }
    if (value === reveal.chosen && !reveal.correct) {
      return "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    }
    return "border bg-card opacity-50";
  };

  return (
    <div className="container mx-auto max-w-xl px-4 py-6">
      {/* progress */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* HUD */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <Heart key={i} className={`h-5 w-5 transition-all ${i < hearts ? "fill-rose-500 text-rose-500" : "scale-90 text-muted-foreground/30"}`} />
          ))}
        </div>
        <div className="text-sm font-medium text-muted-foreground">{Math.min(current + 1, total)} / {total}</div>
        <div className="flex items-center gap-3">
          {combo >= 2 && (
            <motion.span key={combo} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-sm font-bold text-orange-500">
              <Flame className="h-4 w-4" /> {combo}x
            </motion.span>
          )}
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            <Trophy className="h-4 w-4" /> {score}
          </span>
          <span className={`flex items-center gap-1 text-sm tabular-nums ${timeLeft <= 5 ? "font-bold text-rose-500" : "text-muted-foreground"}`}>
            <Clock className="h-4 w-4" /> {timeLeft}s
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5 p-6 shadow-sm">
        {/* milestone burst */}
        <AnimatePresence>
          {milestone && (
            <motion.div
              initial={{ y: -10, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow"
            >
              {milestone}
            </motion.div>
          )}
        </AnimatePresence>

        {/* pet + topic + flying treat + points pop */}
        <div className="relative flex flex-col items-center">
          <motion.div animate={pet === "happy" ? { scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.4 }}>
            <AnimatePresence mode="wait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img key={pet} src={PET_GIF[pet]} alt="Pet" width={96} height={96}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} />
            </AnimatePresence>
          </motion.div>

          {/* treat flies up to the pet on a correct answer */}
          <AnimatePresence>
            {reveal?.correct && (
              <motion.div
                key={`treat-${current}`}
                className="pointer-events-none absolute text-2xl"
                initial={{ y: 60, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {TREATS[current % TREATS.length]}
              </motion.div>
            )}
          </AnimatePresence>

          {/* floating +points */}
          <AnimatePresence>
            {pointsPop !== null && (
              <motion.div
                key={`pop-${current}`}
                className="pointer-events-none absolute -top-1 right-6 text-lg font-extrabold text-emerald-500"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -26, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                +{pointsPop}
              </motion.div>
            )}
          </AnimatePresence>

          {problem && (
            <span className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {problem.topic}
            </span>
          )}
        </div>

        {/* prompt */}
        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className="my-5 text-center text-2xl font-bold md:text-3xl">
            {problem?.prompt}
          </motion.div>
        </AnimatePresence>

        {/* choices */}
        <div className="grid grid-cols-2 gap-3">
          {problem?.choices.map((c) => (
            <button key={c} onClick={() => submit(c)} disabled={!!reveal}
              className={`min-h-[3.5rem] break-words rounded-xl px-4 py-3 text-lg font-semibold shadow-sm transition-all ${choiceClass(c)}`}>
              {c}
            </button>
          ))}
        </div>

        {/* teaching reveal */}
        <AnimatePresence>
          {reveal && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className={`rounded-xl border p-4 ${reveal.correct ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20" : "border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20"}`}>
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  {reveal.correct ? (
                    <span className="text-emerald-600">{CHEERS[current % CHEERS.length]}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <GraduationCap className="h-4 w-4" />
                      {reveal.chosen === null ? "Time's up — let's learn this:" : "Not quite — here's how:"}
                    </span>
                  )}
                </div>
                {!reveal.correct && reveal.correctValue && (
                  <p className="mb-1 text-sm">
                    Correct answer: <span className="font-bold text-emerald-600">{reveal.correctValue}</span>
                  </p>
                )}
                {reveal.solution && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{reveal.solution}</p>
                )}
                {!reveal.correct && (
                  <Button size="sm" className="mt-3" onClick={goNext}>
                    Got it, keep going <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
