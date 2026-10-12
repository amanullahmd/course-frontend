"use client";

import { Check, CircleCheck, CircleX, Hourglass, MessageSquareText, TimerOff, X } from "lucide-react";
import type { AttemptAnswerResult, AttemptResultDto } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InlineHtml } from "@/components/course/rich-content";
import { AnswerDetail, AnswerPrompt, isLanguageType } from "./answer-detail";
import { ScoreRing } from "./score-ring";

function AnswerReview({ answer, index }: { answer: AttemptAnswerResult; index: number }) {
  const t = useTranslations();
  const choice = answer.type === "SINGLE_CHOICE" || answer.type === "MULTIPLE_CHOICE" || answer.type === "TRUE_FALSE";
  const graded = answer.pointsAwarded != null;
  const partial = graded && answer.correct === false && (answer.pointsAwarded ?? 0) > 0 && (answer.pointsAwarded ?? 0) < answer.points;
  const status =
    answer.correct === true ? "correct" : partial ? "partial" : answer.correct === false ? "wrong" : graded ? "graded" : "pending";
  return (
    <li className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {t("quiz.questionN", { n: index + 1, type: t(`questionTypes.${answer.type}.label`) })}
          </p>
          <p className="mt-1 font-medium">
            <AnswerPrompt answer={answer} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {status === "correct" && (
            <Badge variant="success">
              <Check /> {t("quiz.correct")}
            </Badge>
          )}
          {status === "partial" && <Badge variant="warning">{t("exercises.review.partial")}</Badge>}
          {status === "wrong" && (
            <Badge variant="destructive">
              <X /> {t("quiz.incorrect")}
            </Badge>
          )}
          {status === "pending" && (
            <Badge variant="info">
              <Hourglass /> {t("quiz.awaitingGrading")}
            </Badge>
          )}
          {status === "graded" && <Badge variant="secondary">{t("quiz.graded")}</Badge>}
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("quiz.ptsOf", { awarded: graded ? String(answer.pointsAwarded) : "–", points: answer.points })}
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
                {o.correct === true && <CircleCheck className="size-4 text-success" aria-label={t("quiz.correctOption")} />}
                {selected && o.correct === false && <CircleX className="size-4 text-destructive" aria-label={t("quiz.wrongChoice")} />}
              </li>
            );
          })}
        </ul>
      )}

      {isLanguageType(answer.type) && <AnswerDetail answer={answer} />}

      {!choice && !isLanguageType(answer.type) && (
        <div className="mt-4 grid gap-2 text-sm">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("quiz.yourAnswer")}</p>
            <p className="mt-0.5 whitespace-pre-line">{answer.textAnswer?.trim() || <em className="text-muted-foreground">{t("quiz.noAnswer")}</em>}</p>
          </div>
          {answer.acceptedAnswers && answer.acceptedAnswers.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success-soft/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t("quiz.accepted")}</p>
              <p className="mt-0.5 font-medium">{answer.acceptedAnswers.join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      {answer.explanation && (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{t("quiz.explanation")}</span>
          <InlineHtml html={answer.explanation} />
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
  const t = useTranslations("quiz");
  const fmt = useFormat();
  const pending = result.pendingManualGrading || result.status === "SUBMITTED";
  return (
    <div className="grid gap-8 animate-slide-up">
      {result.autoSubmitted && (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft/60 px-4 py-3 text-sm">
          <TimerOff className="mt-0.5 size-4 shrink-0 text-info" />
          {t("autoSubmittedNotice")}
        </p>
      )}
      <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card p-6 text-center sm:flex-row sm:text-left">
        <ScoreRing percent={result.percent} passed={result.passed} pending={pending} />
        <div className="grid gap-2">
          {pending ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-info sm:justify-start">
              <Hourglass className="size-5" /> {t("pendingGrading")}
            </p>
          ) : result.passed ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-success sm:justify-start">
              <CircleCheck className="size-5" /> {t("passedTitle")}
            </p>
          ) : result.passed === false ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-destructive sm:justify-start">
              <CircleX className="size-5" /> {t("failedTitle")}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {t("pointsOf", { score: result.score ?? 0, max: result.maxScore ?? 0 })}
            {passingScore != null && ` · ${t("needed", { percent: passingScore })}`}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start">
            {t("submittedOn", { date: fmt.dateTime(result.submittedAt) })}
            {result.late && <Badge variant="warning">{t("late")}</Badge>}
            {result.autoSubmitted && (
              <Badge variant="info">
                <TimerOff /> {t("autoSubmitted")}
              </Badge>
            )}
          </p>
          {pending && (
            <p className="text-sm text-muted-foreground">{t("pendingText")}</p>
          )}
        </div>
      </div>
      {result.answers.length > 0 && (
        <section aria-label={t("reviewHeading")}>
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("reviewHeading")}</h3>
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
