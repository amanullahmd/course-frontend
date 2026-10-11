"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Flag, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import type { AttemptResultDto, AttemptSessionDto } from "@/lib/api/types";
import { cn, pluralize } from "@/lib/utils";
import { useSubmitAttempt } from "@/hooks/queries/student";
import { removePersisted, usePersistentState } from "@/hooks/use-local-storage";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { emptyAnswer, isAnswered, QuestionInput, QuestionMedia, QuestionPrompt, type DraftAnswer } from "./question-input";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Countdown({ deadline, onExpire }: { deadline: string; onExpire: () => void }) {
  const now = useNow();
  const end = React.useMemo(() => new Date(deadline).getTime(), [deadline]);
  const remaining = now ? end - now : Number.POSITIVE_INFINITY;
  const fired = React.useRef(false);
  const onExpireRef = React.useRef(onExpire);
  React.useEffect(() => {
    onExpireRef.current = onExpire;
  });
  React.useEffect(() => {
    if (remaining <= 0 && !fired.current) {
      fired.current = true;
      onExpireRef.current();
    }
  }, [remaining]);
  const urgent = remaining < 60_000;
  const warn = remaining < 5 * 60_000;
  return (
    <div
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      aria-label="Time remaining"
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm font-semibold tabular-nums transition-colors",
        urgent ? "animate-pulse border-destructive/40 bg-destructive-soft text-destructive" : warn ? "border-warning/40 bg-warning-soft text-warning" : "bg-card",
      )}
    >
      <Timer className="size-4" />
      {Number.isFinite(remaining) ? formatRemaining(remaining) : "--:--"}
    </div>
  );
}

export function QuizPlayer({
  session,
  itemId,
  courseId,
  title,
  onSubmitted,
}: {
  session: AttemptSessionDto;
  itemId: string;
  courseId: string;
  title: string;
  onSubmitted: (result: AttemptResultDto) => void;
}) {
  const storageKey = `sw.attempt.${session.id}`;
  const [answers, setAnswers] = usePersistentState<Record<string, DraftAnswer>>(storageKey, {});
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [index, setIndex] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const submit = useSubmitAttempt(itemId, courseId);
  const questions = session.questions;
  const q = questions[index];
  const answeredCount = questions.filter((x) => isAnswered(x, answers[x.id])).length;
  const unanswered = questions.length - answeredCount;

  const doSubmit = React.useCallback(
    (auto = false) => {
      if (submit.isPending || submit.isSuccess) return;
      submit.mutate(
        {
          attemptId: session.id,
          body: {
            answers: questions.map((x) => ({
              questionId: x.id,
              selectedOptionIds: answers[x.id]?.selectedOptionIds ?? [],
              textAnswer: answers[x.id]?.textAnswer?.trim() ? answers[x.id].textAnswer : null,
            })),
          },
        },
        {
          onSuccess: (result) => {
            removePersisted(storageKey);
            if (auto) toast.info("Time's up! Your answers were submitted automatically.");
            else toast.success("Submitted. Gut gemacht!");
            onSubmitted(result);
          },
        },
      );
    },
    [answers, onSubmitted, questions, session.id, storageKey, submit],
  );

  if (!q) return null;
  const setAnswer = (value: DraftAnswer) => setAnswers({ ...answers, [q.id]: value });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {answeredCount} of {questions.length} answered · autosaved
          </p>
        </div>
        {session.deadline && <Countdown deadline={session.deadline} onExpire={() => doSubmit(true)} />}
      </div>
      <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} className="h-1 rounded-none" />

      <div className="grid gap-0 lg:grid-cols-[1fr_200px]">
        <div className="p-5 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground tabular-nums">
              Question {index + 1} of {questions.length} · {pluralize(q.points, "point")}
            </p>
            <Button
              variant="ghost"
              size="xs"
              aria-pressed={!!flags[q.id]}
              onClick={() => setFlags({ ...flags, [q.id]: !flags[q.id] })}
              className={cn(flags[q.id] && "text-warning")}
            >
              <Flag className={cn(flags[q.id] && "fill-current")} /> {flags[q.id] ? "Flagged" : "Flag for review"}
            </Button>
          </div>
          <div className="mt-4 grid gap-5" key={q.id}>
            <div id={`q-${q.id}-prompt`}>
              <QuestionPrompt prompt={q.prompt} type={q.type} />
            </div>
            <QuestionMedia media={q.media} />
            <QuestionInput question={q} value={answers[q.id] ?? emptyAnswer} onChange={setAnswer} />
          </div>
          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft /> Back
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex(index + 1)}>
                Next <ArrowRight />
              </Button>
            ) : (
              <Button variant="brand" onClick={() => setConfirmOpen(true)} loading={submit.isPending}>
                <Send /> Submit answers
              </Button>
            )}
          </div>
        </div>

        <aside className="border-t p-4 lg:border-t-0 lg:border-l" aria-label="Question navigator">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Questions</p>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
            {questions.map((x, i) => {
              const done = isAnswered(x, answers[x.id]);
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flags[x.id] ? ", flagged" : ""}`}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border text-xs font-medium tabular-nums transition-colors hover:border-foreground/30",
                    done && "border-transparent bg-primary text-primary-foreground",
                    i === index && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                  )}
                >
                  {i + 1}
                  {flags[x.id] && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-warning" />}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setConfirmOpen(true)}>
            Finish attempt
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit your answers?"
        description={
          unanswered > 0
            ? `You still have ${pluralize(unanswered, "unanswered question")}. You can't change your answers after submitting.`
            : "All questions are answered. You can't change your answers after submitting."
        }
        confirmLabel="Submit now"
        loading={submit.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          doSubmit(false);
        }}
      />
    </div>
  );
}
