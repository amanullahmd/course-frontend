"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, Check, ChevronRight, Circle, Clock, MessageSquareText, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { reportCsv } from "@/lib/api/reports";
import { isApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useStudentReport } from "@/hooks/queries/reports";
import { PageContainer } from "@/components/layout/page-header";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Meter, ProgressRing } from "./charts";
import { DownloadButton, PrintButton, PrintHeader, ReportSection, useReportFormat } from "./report-kit";

function LearnerSkeleton() {
  return (
    <PageContainer wide>
      <Skeleton className="h-4 w-64" />
      <div className="mt-5 flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="grid gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-xl" />
    </PageContainer>
  );
}

/** /instructor/courses/[courseId]/reports/students/[studentId]: everything one learner did in one course. */
export function LearnerReport() {
  const { courseId, studentId } = useParams<{ courseId: string; studentId: string }>();
  const t = useTranslations("reports");
  const f = useReportFormat();
  const report = useStudentReport(courseId, studentId);

  if (report.isPending) return <LearnerSkeleton />;
  if (report.isError) {
    const missing = isApiError(report.error) && (report.error.status === 404 || report.error.status === 400);
    return (
      <PageContainer>
        {missing ? (
          <EmptyState
            icon={UserX}
            title={t("learner.notFound")}
            description={t("learner.notFoundText")}
            action={
              <Button asChild>
                <Link href={`/instructor/courses/${courseId}?tab=reports&view=learners`}>{t("learner.back")}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={report.error} onRetry={() => report.refetch()} />
        )}
      </PageContainer>
    );
  }

  const r = report.data;
  const s = r.student;
  const enrolledAt = r.enrollment.decidedAt ?? r.enrollment.appliedAt;

  return (
    <PageContainer wide className="report-root">
      <PrintHeader title={t("learner.title")} course={r.course.title} subject={`${s.fullName} · ${s.email}`} />
      <nav aria-label={t("learner.breadcrumb")} className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground print:hidden">
        <Link href="/instructor/courses" className="shrink-0 hover:text-foreground">
          {t("learner.myCourses")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link href={`/instructor/courses/${r.course.id}?tab=reports`} className="max-w-[40vw] truncate hover:text-foreground">
          {r.course.title}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link href={`/instructor/courses/${r.course.id}?tab=reports&view=learners`} className="shrink-0 hover:text-foreground">
          {t("views.learners")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="truncate text-foreground">{s.fullName}</span>
      </nav>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5 report-card">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar name={s.fullName} src={s.avatarUrl} className="size-14 text-lg sm:size-16" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{s.fullName}</h1>
            <a href={`mailto:${s.email}`} className="block truncate text-sm text-muted-foreground hover:text-foreground">
              {s.email}
            </a>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {t("learner.enrolled", { date: f.date(enrolledAt) })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" />{" "}
                {r.lastActivityAt ? t("learner.lastActive", { when: f.relative(r.lastActivityAt) }) : t("learner.noActivity")}
              </span>
              {r.enrollment.status !== "APPROVED" && <Badge variant="warning">{t(`enrollment.${r.enrollment.status}`)}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-5">
          <ProgressRing
            value={r.progressPercent}
            display={f.pct0(r.progressPercent)}
            label={t("learner.progressLabel", { percent: f.pct0(r.progressPercent) })}
          />
          <div className="flex flex-col gap-2">
            <DownloadButton path={reportCsv.student(r.course.id, s.id)} />
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="kpi-grid mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("learner.items")} value={`${r.completedItems}/${r.totalLiveItems}`} hint={t("learner.itemsHint")} />
        <StatCard
          label={t("learner.assessments")}
          value={`${r.totals.assessmentsAttempted}/${r.totals.assessments}`}
          hint={t("learner.passedHint", { count: r.totals.assessmentsPassed })}
        />
        <StatCard label={t("learner.averageScore")} value={f.pct(r.totals.averageBestPercent)} hint={t("learner.averageScoreHint")} accent="brand" />
        <StatCard
          label={t("learner.feedback")}
          value={f.num(r.feedbackCount)}
          icon={MessageSquareText}
          hint={r.totals.pendingGrading > 0 ? t("learner.pendingHint", { count: r.totals.pendingGrading }) : t("learner.attemptsHint", { count: r.totals.attempts })}
        />
      </div>

      <div className="report-grid mt-4 grid gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ReportSection title={t("learner.progressTitle")} description={t("learner.progressText")} className="print-break-ok">
          {r.modules.length === 0 ? (
            <EmptyState compact title={t("empty.noContent")} description={t("empty.noContentText")} />
          ) : (
            <div className="grid gap-5">
              {r.modules.map((m) => (
                <div key={m.moduleId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="min-w-0 truncate text-sm font-semibold">{m.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {m.completedItems}/{m.totalItems} · {f.pct0(m.progressPercent)}
                    </span>
                  </div>
                  <Meter value={m.progressPercent} className="mt-1.5" label={m.title} barClassName={m.progressPercent === 100 ? "bg-success" : "bg-brand"} />
                  <ul className="mt-2 grid gap-0.5">
                    {m.items.map((i) => (
                      <li key={i.itemId} className="flex items-center gap-2.5 rounded-md py-1.5 text-sm">
                        <ItemTypeIcon type={i.type} className="size-6 [&_svg]:size-3.5" />
                        <span className={cn("min-w-0 flex-1 truncate", !i.completedAt && "text-muted-foreground")}>{i.title}</span>
                        {i.completedAt ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-success" title={f.dateTime(i.completedAt)}>
                            <Check className="size-3.5" aria-hidden />
                            <span className="tabular-nums">{f.date(i.completedAt)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Circle className="size-3" aria-hidden /> {t("learner.open")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </ReportSection>

        <ReportSection title={t("learner.attemptsTitle")} description={t("learner.attemptsText")} bodyClassName="px-0 sm:px-0" className="print-break-ok">
          {r.attempts.length === 0 ? (
            <div className="px-4 sm:px-5">
              <EmptyState compact title={t("empty.noAttempts")} description={t("empty.noAttemptsLearner")} />
            </div>
          ) : (
            <div className="report-scroll overflow-x-auto border-t">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">{t("learner.attemptsTitle")}</caption>
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th scope="col" className="h-10 px-3 pl-4 text-left font-medium uppercase sm:pl-5">{t("col.assessment")}</th>
                    <th scope="col" className="px-3 text-left font-medium uppercase">{t("col.submitted")}</th>
                    <th scope="col" className="px-3 text-right font-medium uppercase">{t("col.score")}</th>
                    <th scope="col" className="px-3 text-left font-medium uppercase">{t("col.result")}</th>
                    <th scope="col" className="px-3 pr-4 text-right font-medium uppercase sm:pr-5"><span className="sr-only">{t("cell.open")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.attempts].reverse().map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2.5 pr-3 pl-4 sm:pl-5">
                        <div className="flex items-center gap-2">
                          {a.itemType && <ItemTypeIcon type={a.itemType} className="size-6 [&_svg]:size-3.5" />}
                          <span className="min-w-0 truncate font-medium">{a.itemTitle ?? "–"}</span>
                        </div>
                      </td>
                      <td className="px-3 whitespace-nowrap text-muted-foreground">
                        {a.submittedAt ? f.dateTime(a.submittedAt) : t("cell.inProgress")}
                        <span className="block text-xs">{t("learner.started", { date: f.dateTime(a.startedAt) })}</span>
                      </td>
                      <td className="px-3 text-right whitespace-nowrap tabular-nums">
                        {a.score != null ? (
                          <>
                            <span className="font-medium">{f.pct(a.percent)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {f.num(a.score)}/{f.num(a.maxScore)}
                            </span>
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-3">
                        <div className="flex flex-wrap gap-1">
                          {a.status === "IN_PROGRESS" ? (
                            <Badge variant="secondary">{t("cell.IN_PROGRESS")}</Badge>
                          ) : a.pendingManualGrading ? (
                            <Badge variant="info">{t("cell.SUBMITTED_PENDING")}</Badge>
                          ) : a.passed ? (
                            <Badge variant="success">{t("legend.passed")}</Badge>
                          ) : (
                            <Badge variant="destructive">{t("legend.failed")}</Badge>
                          )}
                          {a.late && <Badge variant="warning">{t("learner.late")}</Badge>}
                          {a.autoSubmitted && <Badge variant="outline">{t("learner.autoSubmitted")}</Badge>}
                        </div>
                      </td>
                      <td className="px-3 pr-4 text-right sm:pr-5">
                        {a.status !== "IN_PROGRESS" && (
                          <Button variant="ghost" size="xs" asChild className="print:hidden">
                            <Link href={`/instructor/courses/${r.course.id}/items/${a.itemId}?tab=submissions&attempt=${a.id}`}>
                              {a.pendingManualGrading ? t("learner.grade") : t("learner.review")}
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>
      </div>
    </PageContainer>
  );
}
