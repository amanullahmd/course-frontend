"use client";

import { Check, CircleCheck, CircleX, Hourglass, MessageSquareText, X } from "lucide-react";
import type { AttemptAnswerResult, AttemptResultDto } from "@/lib/api/types";
import { QUESTION_TYPE_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InlineHtml } from "@/components/course/rich-content";
import { ScoreRing } from "./score-ring";

function AnswerReview({ answer, index }: { answer: AttemptAnswerResult; index: number }) {
  const choice = answer.type === "SINGLE_CHOICE" || answer.type === "MULTIPLE_CHOICE" || answer.type === "TRUE_FALSE";
  const graded = answer.pointsAwarded != null;
  const status =
    answer.correct === true ? "correct" : answer.correct === false ? "wrong" : graded ? "graded" : "pending";
  return (
    <li className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Question {index + 1} · {QUESTION_TYPE_META[answer.type].label}
          </p>
          <p className="mt-1 font-medium">
            <InlineHtml html={answer.prompt} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status === "correct" && (
            <Badge variant="success">
              <Check /> Correct
            </Badge>
          )}
          {status === "wrong" && (
            <Badge variant="destructive">
              <X /> Incorrect
            </Badge>
          )}
          {status === "pending" && (
            <Badge variant="info">
              <Hourglass /> Awaiting grading
            </Badge>
          )}
          {status === "graded" && <Badge variant="secondary">Graded</Badge>}
          <span className="text-xs text-muted-foreground tabular-nums">
            {graded ? answer.pointsAwarded : "–"} / {answer.points} pts
          </span>
        </div>
      </div>

      {choice && answer.options && (
        <ul className="mt-4 grid gap-1.5">
          {answer.options.map((o) => {
            const selected = answer.selectedOptionIds.includes(o.id);
            return (
              <li
                key={o.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                  o.correct === true && "border-success/40 bg-success-soft/50",
                  selected && o.correct === false && "border-destructive/40 bg-destructive-soft/50",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border",
                    selected && "border-foreground bg-foreground text-background",
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">{o.text}</span>
                {o.correct === true && <CircleCheck className="size-4 text-success" aria-label="Correct option" />}
                {selected && o.correct === false && <CircleX className="size-4 text-destructive" aria-label="Wrong choice" />}
              </li>
            );
          })}
        </ul>
      )}

      {!choice && (
        <div className="mt-4 grid gap-2 text-sm">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">Your answer</p>
            <p className="mt-0.5 whitespace-pre-line">{answer.textAnswer?.trim() || <em className="text-muted-foreground">No answer</em>}</p>
          </div>
          {answer.acceptedAnswers && answer.acceptedAnswers.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success-soft/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Accepted answers</p>
              <p className="mt-0.5 font-medium">{answer.acceptedAnswers.join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      {answer.explanation && (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">Erklärung: </span>
          {answer.explanation}
        </p>
      )}

      {answer.feedback && (
        <div className="mt-3 flex gap-2 rounded-lg border-l-2 border-brand bg-brand-soft/30 px-3 py-2 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-brand-strong" />
          <p className="whitespace-pre-line">{answer.feedback}</p>
        </div>
      )}
    </li>
  );
}

export function ResultsView({ result, passingScore }: { result: AttemptResultDto; passingScore?: number }) {
  const pending = result.pendingManualGrading || result.status === "SUBMITTED";
  return (
    <div className="grid gap-8 animate-slide-up">
      <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 text-center sm:flex-row sm:text-left">
        <ScoreRing percent={result.percent} passed={result.passed} pending={pending} />
        <div className="grid gap-2">
          {pending ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-info sm:justify-start">
              <Hourglass className="size-5" /> Waiting for manual grading
            </p>
          ) : result.passed ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-success sm:justify-start">
              <CircleCheck className="size-5" /> Bestanden! You passed.
            </p>
          ) : result.passed === false ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-destructive sm:justify-start">
              <CircleX className="size-5" /> Not passed this time
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {result.score ?? 0} of {result.maxScore ?? 0} points
            {passingScore != null && ` · ${passingScore}% needed to pass`}
          </p>
          <p className="text-xs text-muted-foreground">Submitted {formatDateTime(result.submittedAt)}</p>
          {pending && (
            <p className="text-sm text-muted-foreground">
              Some answers (like essays) are graded by your instructor. Your final score will appear here, and you&apos;ll get a
              notification once grading is complete.
            </p>
          )}
        </div>
      </div>
      {result.answers.length > 0 && (
        <section aria-label="Answer review">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Review</h3>
          <ol className="grid gap-3">
            {result.answers.map((a, i) => (
              <AnswerReview key={a.questionId} answer={a} index={i} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
