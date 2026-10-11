"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, ClipboardList, Clock, Lock, PlayCircle, RotateCcw, Target, Trophy } from "lucide-react";
import type { AttemptResultDto, AttemptSessionDto, LearnItemDto } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useMyAttempt, useMyAttempts, useStartAttempt } from "@/hooks/queries/student";
import { useNow } from "@/hooks/use-now";
import { RichContent } from "@/components/course/rich-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuizPlayer } from "./quiz-player";
import { ResultsView } from "./results-view";

type View = { kind: "intro" } | { kind: "play"; session: AttemptSessionDto } | { kind: "result"; attemptId: string };

function ResultLoader({ attemptId, passingScore }: { attemptId: string; passingScore: number }) {
  const attempt = useMyAttempt(attemptId);
  if (attempt.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (attempt.isError) return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />;
  return <ResultsView result={attempt.data} passingScore={passingScore} />;
}

export function AssessmentPanel({ item }: { item: LearnItemDto }) {
  const t = useTranslations("quiz");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const info = item.assessment;
  const [view, setView] = React.useState<View>({ kind: "intro" });
  const attempts = useMyAttempts(item.id, !!info);
  const start = useStartAttempt(item.id);
  const now = useNow();

  if (!info) {
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{t("noQuestions")}</p>;
  }

  if (view.kind === "play") {
    return (
      <QuizPlayer
        key={view.session.id}
        session={view.session}
        itemId={item.id}
        courseId={item.courseId}
        title={item.title}
        onSubmitted={(result: AttemptResultDto) => setView({ kind: "result", attemptId: result.id })}
      />
    );
  }

  if (view.kind === "result") {
    return (
      <div className="grid gap-4">
        <ResultLoader attemptId={view.attemptId} passingScore={info.passingScore} />
        <Button variant="outline" className="w-fit" onClick={() => setView({ kind: "intro" })}>
          {t("backToOverview")}
        </Button>
      </div>
    );
  }

  const isExam = item.type === "EXAM";
  const notYetOpen = !!info.availableFrom && now > 0 && new Date(info.availableFrom).getTime() > now;
  const closed = !!info.availableUntil && now > 0 && new Date(info.availableUntil).getTime() < now;
  const noAttemptsLeft = info.maxAttempts > 0 && info.attemptsUsed >= info.maxAttempts && !info.inProgressAttemptId;
  const canStart = !notYetOpen && !closed && !noAttemptsLeft && info.questionCount > 0;
  const resume = !!info.inProgressAttemptId;

  const stats = [
    { icon: ClipboardList, label: t("questions"), value: info.questionCount },
    { icon: Target, label: t("points"), value: info.totalPoints },
    { icon: Clock, label: t("timeLimit"), value: info.timeLimitMinutes ? tc("minutesShort", { count: info.timeLimitMinutes }) : tc("none") },
    {
      icon: RotateCcw,
      label: t("attempts"),
      value: info.maxAttempts > 0 ? `${info.attemptsUsed} / ${info.maxAttempts}` : `${info.attemptsUsed} / ∞`,
    },
    { icon: CircleCheck, label: t("passMark"), value: `${info.passingScore}%` },
    { icon: Trophy, label: t("bestScore"), value: info.bestPercent != null ? `${Math.round(info.bestPercent)}%` : "–" },
  ];

  return (
    <div className="grid gap-8">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className={cn("border-b px-5 py-4 sm:px-6", isExam ? "bg-orange-500/5" : "bg-amber-500/5")}>
          <Badge variant={isExam ? "warning" : "brand"}>{isExam ? t("exam") : t("quiz")}</Badge>
          {info.instructions ? (
            <RichContent html={info.instructions} className="mt-3 text-[15px]" />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("defaultInstructions")} {info.timeLimitMinutes ? t("timerInstructions") : ""}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-card px-5 py-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s.icon className="size-3.5" /> {s.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        {(info.availableFrom || info.availableUntil) && (
          <p className="flex items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground sm:px-6">
            <CalendarClock className="size-4" />
            {t("available")} {info.availableFrom ? t("from", { date: fmt.dateTime(info.availableFrom) }) : ""}
            {info.availableUntil ? ` ${t("until", { date: fmt.dateTime(info.availableUntil) })}` : ""}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">
            {notYetOpen && (
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" /> {t("opens", { date: fmt.dateTime(info.availableFrom) })}
              </span>
            )}
            {closed && (
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" /> {t("closedOn", { date: fmt.dateTime(info.availableUntil) })}
              </span>
            )}
            {noAttemptsLeft && !closed && !notYetOpen && t("noAttemptsLeft")}
            {canStart && !resume && (info.maxAttempts > 0 ? t("attemptsRemaining", { count: info.maxAttempts - info.attemptsUsed }) : t("unlimitedAttempts"))}
            {canStart && resume && t("inProgressHint")}
          </p>
          <Button
            size="lg"
            variant={resume ? "brand" : "default"}
            disabled={!canStart && !resume}
            loading={start.isPending}
            onClick={() => start.mutate(undefined, { onSuccess: (session) => setView({ kind: "play", session }) })}
          >
            <PlayCircle /> {resume ? t("resume") : info.attemptsUsed > 0 ? t("startNew") : isExam ? t("startExam") : t("startQuiz")}
          </Button>
        </div>
      </div>

      {attempts.data && attempts.data.length > 0 && (
        <section aria-label={t("yourAttempts")}>
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("yourAttempts")}</h3>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("submitted")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("score")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.data.map((a, i) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">{attempts.data.length - i}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {a.submittedAt ? fmt.dateTime(a.submittedAt) : t("inProgress")}
                    </TableCell>
                    <TableCell>
                      {a.status === "IN_PROGRESS" ? (
                        <Badge variant="info">{t("inProgress")}</Badge>
                      ) : a.pendingManualGrading ? (
                        <Badge variant="info">{t("awaitingGrading")}</Badge>
                      ) : a.passed ? (
                        <Badge variant="success">{t("passed")}</Badge>
                      ) : (
                        <Badge variant="destructive">{t("notPassed")}</Badge>
                      )}
                      {a.submittedAt && <p className="mt-1 text-xs whitespace-nowrap text-muted-foreground sm:hidden">{fmt.date(a.submittedAt)}</p>}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {a.percent != null ? `${Math.round(a.percent)}%` : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status !== "IN_PROGRESS" && (
                        <Button variant="ghost" size="xs" onClick={() => setView({ kind: "result", attemptId: a.id })}>
                          {t("review")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
