"use client";

import * as React from "react";
import { BadgeCheck, ChartColumn, Clock, Inbox, Target, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { QuestionStats } from "@/lib/api/reports";
import { reportCsv } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { useAssessmentAnalytics } from "@/hooks/queries/reports";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ColumnChart, Meter } from "./charts";
import { DownloadButton, PrintButton, PrintHeader, ReportSection, useReportFormat } from "./report-kit";

const HARD = 40;
const VERY_EASY = 95;

function difficulty(q: QuestionStats): "hard" | "veryEasy" | null {
  if (q.percentCorrect == null) return null;
  if (q.percentCorrect < HARD) return "hard";
  if (q.percentCorrect > VERY_EASY) return "veryEasy";
  return null;
}

/** "Analytics" tab of the quiz/exam editor: score distribution, pass rate, duration and per-question difficulty. */
export function AssessmentAnalytics({ itemId, active = true }: { itemId: string; active?: boolean }) {
  const t = useTranslations("reports");
  const tq = useTranslations("questionTypes");
  const f = useReportFormat();
  const data = useAssessmentAnalytics(itemId, active);

  if (data.isPending) {
    return (
      <div className="grid gap-4" aria-busy>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  const a = data.data;

  const actions = (
    <>
      <DownloadButton path={reportCsv.attempts(itemId)} label={t("analytics.exportAttempts")} />
      <PrintButton />
    </>
  );

  if (a.attempts === 0) {
    return (
      <div className="report-root grid gap-4">
        <EmptyState
          icon={ChartColumn}
          title={t("empty.noAttempts")}
          description={a.inProgress > 0 ? t("analytics.inProgressOnly", { count: a.inProgress }) : t("empty.noAttemptsText")}
        />
      </div>
    );
  }

  return (
    <div className="report-root grid gap-4 sm:gap-6">
      <PrintHeader title={t("analytics.printTitle", { title: a.title })} course={a.course.title} />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">{t("analytics.basis", { count: a.attempts, learners: a.uniqueLearners })}</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>

      <div className="kpi-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("analytics.attempts")}
          value={f.num(a.attempts)}
          icon={Users}
          hint={t("analytics.learners", { count: a.uniqueLearners })}
        />
        <StatCard
          label={t("analytics.average")}
          value={f.pct(a.averagePercent)}
          icon={Target}
          accent="brand"
          hint={a.medianPercent != null ? t("kpi.median", { value: f.pct(a.medianPercent) }) : t("analytics.noGraded")}
        />
        <StatCard
          label={t("kpi.passRate")}
          value={f.pct0(a.passRate)}
          icon={BadgeCheck}
          accent="success"
          hint={t("analytics.passingScore", { score: f.pct0(a.passingScore) })}
        />
        <StatCard
          label={t("analytics.duration")}
          value={f.duration(a.averageDurationSeconds)}
          icon={a.pendingGrading > 0 ? Inbox : Clock}
          accent={a.pendingGrading > 0 ? "info" : "default"}
          hint={a.pendingGrading > 0 ? t("analytics.pending", { count: a.pendingGrading }) : t("analytics.durationHint")}
        />
      </div>

      <ReportSection title={t("analytics.distribution")} description={t("analytics.distributionText", { graded: a.gradedAttempts })}>
        {a.gradedAttempts === 0 ? (
          <EmptyState compact icon={Inbox} title={t("analytics.noGraded")} description={t("analytics.noGradedText")} />
        ) : (
          <ColumnChart
            ariaLabel={t("analytics.distribution")}
            series={[{ name: t("analytics.attempts"), className: "bg-brand" }]}
            data={a.scoreDistribution.map((b) => ({
              key: b.label,
              label: `${b.from}`,
              fullLabel: t("distribution.range", { from: b.from, to: b.to }),
              values: [b.count],
            }))}
            format={(n) => f.num(n)}
            height={160}
          />
        )}
      </ReportSection>

      <ReportSection
        title={t("analytics.questions")}
        description={t("analytics.questionsText", { hard: HARD, easy: VERY_EASY })}
        bodyClassName="px-0 sm:px-0"
        className="print-break-ok"
      >
        <div className="report-scroll relative overflow-x-auto border-t">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{t("analytics.questions")}</caption>
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr className="border-b">
                <th scope="col" className="h-10 w-10 px-3 pl-4 text-left font-medium sm:pl-5">#</th>
                <th scope="col" className="px-3 text-left font-medium">{t("analytics.question")}</th>
                <th scope="col" className="w-56 px-3 text-left font-medium">{t("analytics.correct")}</th>
                <th scope="col" className="px-3 text-right font-medium whitespace-nowrap">{t("analytics.avgPoints")}</th>
                <th scope="col" className="px-3 pr-4 text-left font-medium sm:pr-5">{t("analytics.wrongAnswers")}</th>
              </tr>
            </thead>
            <tbody>
              {a.questions.map((q) => {
                const d = difficulty(q);
                return (
                  <tr key={q.questionId} className="border-b align-top last:border-0">
                    <td className="py-3 pr-3 pl-4 text-muted-foreground tabular-nums sm:pl-5">{q.position}</td>
                    <td className="px-3 py-3">
                      <p className="line-clamp-3 font-medium">{q.prompt || "–"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{tq(`${q.type}.label`)}</span>
                        <span>· {t("analytics.points", { count: q.points })}</span>
                        {q.unanswered > 0 && <span>· {t("analytics.unanswered", { count: q.unanswered })}</span>}
                        {d && (
                          <Badge variant={d === "hard" ? "destructive" : "info"}>{t(`analytics.${d}`)}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {q.percentCorrect == null ? (
                        <span className="text-xs text-muted-foreground">{t("analytics.notEvaluated")}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Meter
                            value={q.percentCorrect}
                            className="w-28"
                            label={t("analytics.correct")}
                            barClassName={cn(d === "hard" ? "bg-destructive" : q.percentCorrect >= 70 ? "bg-success" : "bg-warning")}
                          />
                          <span className="w-12 text-right font-medium tabular-nums">{f.pct0(q.percentCorrect)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {f.num(q.averagePoints)} <span className="text-muted-foreground">/ {q.points}</span>
                    </td>
                    <td className="px-3 py-3 pr-4 sm:pr-5">
                      {q.commonWrongAnswers.length === 0 ? (
                        <span className="text-xs text-muted-foreground">–</span>
                      ) : (
                        <ul className="grid gap-1">
                          {q.commonWrongAnswers.map((w) => (
                            <li key={w.text} className="flex items-center gap-2 text-xs">
                              <span className="max-w-56 truncate rounded bg-destructive-soft px-1.5 py-0.5 text-destructive">{w.text}</span>
                              <span className="text-muted-foreground tabular-nums">×{w.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ReportSection>
    </div>
  );
}
