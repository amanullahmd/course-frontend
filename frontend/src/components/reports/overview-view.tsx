"use client";

import * as React from "react";
import {
  Activity,
  BadgeCheck,
  ChartColumn,
  CircleCheckBig,
  ClipboardCheck,
  Inbox,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ItemEngagement, OverviewReport } from "@/lib/api/reports";
import { reportCsv } from "@/lib/api/reports";
import { isAssessmentType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { ChartDataTable, ColumnChart, Legend, Meter } from "./charts";
import { DownloadButton, ReportSection, useReportFormat } from "./report-kit";

export function OverviewView({ report }: { report: OverviewReport }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const k = report.kpis;
  const noLearners = k.approvedLearners === 0;

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="kpi-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("kpi.learners")}
          value={f.num(k.approvedLearners)}
          icon={Users}
          accent="brand"
          hint={t("kpi.learnersHint", { count: k.pendingApplications })}
        />
        <StatCard
          label={t("kpi.averageProgress")}
          value={f.pct0(k.averageProgress)}
          icon={TrendingUp}
          hint={k.medianProgress != null ? t("kpi.median", { value: f.pct0(k.medianProgress) }) : t("kpi.noLearnersYet")}
        />
        <StatCard
          label={t("kpi.completed")}
          value={f.num(k.completedLearners)}
          icon={CircleCheckBig}
          accent="success"
          hint={k.completionRate != null ? t("kpi.completedHint", { rate: f.pct(k.completionRate) }) : undefined}
        />
        <StatCard
          label={t("kpi.active7d")}
          value={f.num(k.activeLearners7d)}
          icon={Activity}
          accent="info"
          hint={!noLearners ? t("kpi.ofLearners", { count: k.approvedLearners }) : undefined}
        />
        <StatCard
          label={t("kpi.assessments")}
          value={f.num(k.assessments)}
          icon={ClipboardCheck}
          hint={t("kpi.items", { count: k.totalLiveItems })}
        />
        <StatCard label={t("kpi.averageBestScore")} value={f.pct(k.averageBestScore)} icon={Target} hint={t("kpi.averageBestScoreHint")} />
        <StatCard label={t("kpi.passRate")} value={f.pct(k.passRate)} icon={BadgeCheck} accent="success" hint={t("kpi.passRateHint")} />
        <StatCard
          label={t("kpi.pendingGrading")}
          value={f.num(k.pendingGrading)}
          icon={Inbox}
          accent={k.pendingGrading > 0 ? "warning" : "default"}
          hint={k.pendingGrading > 0 ? t("kpi.pendingGradingHint") : t("kpi.allGraded")}
        />
      </div>

      <div className="report-grid grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EnrollmentTimeline report={report} />
        <EnrollmentTotals report={report} />
      </div>

      <div className="report-grid grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ReportSection title={t("distribution.title")} description={t("distribution.text")}>
          {noLearners ? (
            <EmptyState compact icon={Users} title={t("empty.noLearners")} description={t("empty.noLearnersText")} />
          ) : (
            <ColumnChart
              ariaLabel={t("distribution.title")}
              series={[{ name: t("distribution.learners"), className: "bg-brand" }]}
              data={report.progressDistribution.map((b) => ({
                key: b.label,
                label: b.label === "100" ? f.pct0(100) : `${b.from}–${b.to}`,
                fullLabel: b.label === "100" ? t("distribution.complete") : t("distribution.range", { from: b.from, to: b.to }),
                values: [b.count],
              }))}
              format={(n) => f.num(n)}
            />
          )}
        </ReportSection>
        <ReportSection title={t("modules.title")} description={t("modules.text")}>
          {report.modules.length === 0 ? (
            <EmptyState compact icon={ChartColumn} title={t("empty.noContent")} description={t("empty.noContentText")} />
          ) : (
            <ul className="grid gap-3.5">
              {report.modules.map((m, i) => (
                <li key={m.moduleId} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                      {m.title}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{f.pct0(m.completionPercent)}</span>
                  </div>
                  <Meter value={m.completionPercent} label={m.title} barClassName={m.completionPercent === 100 ? "bg-success" : "bg-brand"} />
                  <span className="text-xs text-muted-foreground">{t("modules.items", { count: m.itemCount })}</span>
                </li>
              ))}
            </ul>
          )}
        </ReportSection>
      </div>

      <ContentFunnel report={report} />
    </div>
  );
}

function EnrollmentTimeline({ report }: { report: OverviewReport }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const weeks = report.enrollmentTimeline;
  const series = [
    { name: t("timeline.applications"), className: "bg-info" },
    { name: t("timeline.approvals"), className: "bg-brand" },
  ];
  const total = weeks.reduce((n, w) => n + w.applications + w.approvals, 0);
  return (
    <ReportSection title={t("timeline.title")} description={t("timeline.text", { weeks: weeks.length })} actions={<Legend series={series} />}>
      {total === 0 ? (
        <EmptyState compact icon={UserPlus} title={t("timeline.empty")} description={t("timeline.emptyText")} />
      ) : (
        <ColumnChart
          ariaLabel={t("timeline.title")}
          series={series}
          labelEvery={weeks.length > 8 ? 2 : 1}
          data={weeks.map((w) => ({
            key: w.weekStart,
            label: f.date(w.weekStart, "d.M."),
            fullLabel: t("timeline.weekOf", { date: f.date(w.weekStart) }),
            values: [w.applications, w.approvals],
          }))}
          format={(n) => f.num(n)}
        />
      )}
    </ReportSection>
  );
}

function EnrollmentTotals({ report }: { report: OverviewReport }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const fu = report.funnel;
  const rows: { key: string; label: string; value: number; tone: string }[] = [
    { key: "approved", label: t("funnel.approved"), value: fu.approved, tone: "bg-success" },
    { key: "pending", label: t("funnel.pending"), value: fu.pending, tone: "bg-info" },
    { key: "rejected", label: t("funnel.rejected"), value: fu.rejected, tone: "bg-destructive" },
    { key: "revoked", label: t("funnel.revoked"), value: fu.revoked, tone: "bg-warning" },
    { key: "withdrawn", label: t("funnel.withdrawn"), value: fu.withdrawn, tone: "bg-muted-foreground/60" },
  ];
  const max = Math.max(1, fu.applied);
  return (
    <ReportSection title={t("funnel.title")} description={t("funnel.text")}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">{t("funnel.applied")}</p>
          <p className="text-2xl font-semibold tabular-nums">{f.num(fu.applied)}</p>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">{t("funnel.approvalRate")}</p>
          <p className="text-2xl font-semibold tabular-nums">{f.pct0(fu.approvalRate)}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2.5" aria-label={t("funnel.title")}>
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn("block h-full rounded-full", r.tone)} style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium tabular-nums">{f.num(r.value)}</span>
          </li>
        ))}
      </ul>
    </ReportSection>
  );
}

function ContentFunnel({ report }: { report: OverviewReport }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const groups = React.useMemo(() => {
    const map = new Map<string, { title: string; items: ItemEngagement[] }>();
    for (const i of report.items) {
      const g = map.get(i.moduleId) ?? { title: i.moduleTitle, items: [] };
      g.items.push(i);
      map.set(i.moduleId, g);
    }
    return [...map.entries()];
  }, [report.items]);
  const learners = report.kpis.approvedLearners;

  return (
    <ReportSection
      className="print-break-ok"
      title={t("engagement.title")}
      description={t("engagement.text")}
      actions={<DownloadButton path={reportCsv.progress(report.course.id)} label={t("exportProgress")} />}
    >
      {report.items.length === 0 ? (
        <EmptyState compact icon={ChartColumn} title={t("empty.noContent")} description={t("empty.noContentText")} />
      ) : (
        <div className="grid gap-6">
          {groups.map(([moduleId, g], gi) => (
            <div key={moduleId}>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {gi + 1}. {g.title}
              </h3>
              <ol className="grid gap-1">
                {g.items.map((i) => {
                  const assessment = isAssessmentType(i.type);
                  return (
                    <li
                      key={i.itemId}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2 sm:grid-cols-[auto_minmax(0,16rem)_minmax(0,1fr)_auto] sm:px-2 sm:hover:bg-muted/40"
                    >
                      <ItemTypeIcon type={i.type} className="size-7" />
                      <span className="min-w-0 truncate text-sm font-medium">{i.title}</span>
                      <div className="col-span-2 sm:col-span-1">
                        <Meter
                          value={i.completedPercent}
                          label={t("engagement.completedBy", { count: i.completed, percent: f.pct0(i.completedPercent) })}
                          barClassName={assessment ? "bg-info" : "bg-brand"}
                        />
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground tabular-nums sm:col-span-1 sm:min-w-44 sm:text-right">
                        <span className="text-foreground">{t("engagement.completedShort", { count: i.completed, total: learners })}</span>{" "}
                        · {f.pct0(i.completedPercent)}
                        {assessment && i.taken != null && (
                          <span className="block">
                            {t("engagement.assessment", {
                              taken: i.taken,
                              takenPercent: f.pct0(i.takenPercent),
                              passed: i.passed ?? 0,
                              average: f.pct0(i.averagePercent),
                            })}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
      <ChartDataTable
        caption={t("engagement.title")}
        columns={[t("engagement.item"), t("engagement.completedCol"), t("engagement.takenCol"), t("engagement.passedCol"), t("engagement.averageCol")]}
        rows={report.items.map((i) => [
          i.title,
          `${i.completed} (${f.pct0(i.completedPercent)})`,
          i.taken == null ? "–" : `${i.taken} (${f.pct0(i.takenPercent)})`,
          i.passed == null ? "–" : i.passed,
          f.pct0(i.averagePercent),
        ])}
      />
    </ReportSection>
  );
}
