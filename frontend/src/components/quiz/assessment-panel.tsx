"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CircleCheck, ClipboardList, Clock, Hourglass, Lock, PlayCircle, RotateCcw, Target, TriangleAlert, Trophy } from "lucide-react";
import type { AttemptResultDto, AttemptSessionDto, LearnItemDto } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { qk } from "@/lib/query-keys";
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

const MINUTE = 60_000;

/** "2 h 10 min", "35 min", "3 d 4 h", "< 1 min" (rounded up to whole minutes). */
function useDuration() {
  const t = useTranslations("quiz.duration");
  return React.useCallback(
    (ms: number) => {
      const minutes = Math.max(0, Math.ceil(ms / MINUTE));
      if (ms < MINUTE) return t("lessThanMinute");
      const d = Math.floor(minutes / 1440);
      const h = Math.floor((minutes % 1440) / 60);
      const m = minutes % 60;
      if (d > 0) return h > 0 ? t("daysHours", { d, h }) : t("days", { d });
      if (h > 0) return m > 0 ? t("hoursMinutes", { h, m }) : t("hours", { h });
      return t("minutes", { m });
    },
    [t],
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

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
  // Notification links ("result available") open one attempt directly via ?attempt=<id>.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linkedAttempt = params.get("attempt");
  const [view, setView] = React.useState<View>(() =>
    linkedAttempt && /^[0-9a-f-]{36}$/i.test(linkedAttempt) ? { kind: "result", attemptId: linkedAttempt } : { kind: "intro" },
  );
  const backToOverview = () => {
    setView({ kind: "intro" });
    if (linkedAttempt) router.replace(pathname, { scroll: false });
  };
  const attempts = useMyAttempts(item.id, !!info);
  const start = useStartAttempt(item.id);
  const qc = useQueryClient();
  const now = useNow();
  const duration = useDuration();

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
        <Button variant="outline" className="w-fit" onClick={backToOverview}>
          {t("backToOverview")}
        </Button>
      </div>
    );
  }

  const isExam = item.type === "EXAM";
  const opensAt = info.availableFrom ? new Date(info.availableFrom).getTime() : null;
  const closesAt = info.availableUntil ? new Date(info.availableUntil).getTime() : null;
  // `now` is 0 until hydration; the live values below re-render every second, so the start button re-enables itself
  // the moment the window opens (and disables itself when it closes).
  const notYetOpen = opensAt != null && now > 0 && opensAt > now;
  const closed = closesAt != null && now > 0 && closesAt <= now;
  const noAttemptsLeft = info.maxAttempts > 0 && info.attemptsUsed >= info.maxAttempts && !info.inProgressAttemptId;
  const canStart = now > 0 && !notYetOpen && !closed && !noAttemptsLeft && info.questionCount > 0;
  const resume = !!info.inProgressAttemptId && !closed;
  const windowLabel = (ms: number) => fmt.date(new Date(ms), "EEE d MMM, HH:mm");
  const timeLabel = (ms: number) => (now > 0 && sameDay(ms, now) ? fmt.date(new Date(ms), "HH:mm") : windowLabel(ms));
  // Effective deadline if the learner started right now: the time limit, capped at the window end.
  const limitMs = info.timeLimitMinutes ? info.timeLimitMinutes * MINUTE : null;
  const capped = canStart && limitMs != null && closesAt != null && now + limitMs > closesAt;
  const kind = isExam ? "exam" : "quiz";
  const startAttempt = () =>
    start.mutate(undefined, {
      onSuccess: (session) => setView({ kind: "play", session }),
      // e.g. the window closed meanwhile or an expired attempt was just submitted: show the current state
      onError: () => {
        void qc.invalidateQueries({ queryKey: qk.student.item(item.id) });
        void qc.invalidateQueries({ queryKey: qk.student.attempts(item.id) });
      },
    });

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
        {(opensAt != null || closesAt != null) && (
          <div className="grid gap-2 border-t px-5 py-3 text-sm sm:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              {opensAt != null && (
                <span className={cn(notYetOpen ? "font-medium" : "text-muted-foreground")}>
                  {t(notYetOpen ? "opensAt" : "openedAt", { date: windowLabel(opensAt) })}
                </span>
              )}
              {closesAt != null && (
                <span className={cn(!notYetOpen && !closed ? "font-medium" : "text-muted-foreground")}>
                  {t(closed ? "closedAt" : "closesAt", { date: windowLabel(closesAt) })}
                </span>
              )}
              {now > 0 && notYetOpen && opensAt != null && (
                <Badge variant="info" className="tabular-nums" aria-live="polite">
                  <Hourglass /> {t("opensIn", { time: duration(opensAt - now) })}
                </Badge>
              )}
              {now > 0 && !notYetOpen && !closed && closesAt != null && (
                <Badge variant={closesAt - now < 15 * MINUTE ? "warning" : "secondary"} className="tabular-nums">
                  <Hourglass /> {t("closesIn", { time: duration(closesAt - now) })}
                </Badge>
              )}
            </div>
            {capped && closesAt != null && (
              <p className="flex items-start gap-1.5 text-[13px] text-warning">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {t("cappedHint", { minutes: info.timeLimitMinutes ?? 0, kind, time: timeLabel(closesAt) })}
              </p>
            )}
            {!limitMs && closesAt != null && !closed && (
              <p className="text-[13px] text-muted-foreground">{t("untimedClosesHint", { kind, time: timeLabel(closesAt) })}</p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">
            {notYetOpen && opensAt != null && (
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" /> {t("notOpenYetReason", { kind, date: windowLabel(opensAt) })}
              </span>
            )}
            {closed && closesAt != null && (
              <span className="flex items-center gap-1.5">
                <Lock className="size-4" /> {t("closedReason", { kind, date: windowLabel(closesAt) })}
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
            onClick={startAttempt}
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
                      {a.autoSubmitted && (
                        <Badge variant="info" className="ml-1">
                          {t("autoSubmitted")}
                        </Badge>
                      )}
                      {a.late && (
                        <Badge variant="warning" className="ml-1">
                          {t("late")}
                        </Badge>
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
