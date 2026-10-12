"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, SearchX, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Gradebook, GradebookCell, GradebookColumn, GradebookRow } from "@/lib/api/reports";
import { reportCsv } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { SortHeader, sortRows } from "./learners-view";
import { DownloadButton, ReportSection, cellTone, useReportFormat } from "./report-kit";

type SortKey = "name" | "progress" | "average";

function value(r: GradebookRow, key: SortKey): string | number {
  if (key === "name") return r.fullName.toLocaleLowerCase();
  if (key === "progress") return r.progressPercent;
  return r.averagePercent ?? -1;
}

/** Learners × quizzes/exams matrix with best scores, statuses and per-assessment statistics. */
export function GradebookView({ gradebook, courseId }: { gradebook: Gradebook; courseId: string }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const [query, setQuery] = React.useState("");
  const [onlyNoExam, setOnlyNoExam] = React.useState(false);
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const { rows, columns } = gradebook;
  const hasExam = columns.some((c) => c.type === "EXAM");

  const q = query.trim().toLocaleLowerCase();
  const visible = sortRows(
    rows
      .filter((r) => !q || r.fullName.toLocaleLowerCase().includes(q) || r.email.toLocaleLowerCase().includes(q))
      .filter((r) => !onlyNoExam || (r.examsTotal > 0 && r.examsTaken === 0)),
    sort,
    value,
  );
  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <ReportSection
      className="print-break-ok"
      title={t("gradebook.title")}
      description={t("gradebook.text")}
      actions={<DownloadButton path={reportCsv.gradebook(courseId)} />}
      bodyClassName="px-0 sm:px-0"
    >
      {rows.length === 0 || columns.length === 0 ? (
        <div className="px-4 sm:px-5">
          {rows.length === 0 ? (
            <EmptyState compact icon={Users} title={t("empty.noLearners")} description={t("empty.noLearnersText")} />
          ) : (
            <EmptyState compact icon={ClipboardList} title={t("empty.noAssessments")} description={t("empty.noAssessmentsText")} />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                aria-label={t("gradebook.sortBy")}
                value={sort.key}
                onChange={(k) => setSort({ key: k, dir: k === "name" ? "asc" : "desc" })}
                options={[
                  { value: "name", label: t("gradebook.sortName") },
                  { value: "progress", label: t("gradebook.sortProgress") },
                  { value: "average", label: t("gradebook.sortAverage") },
                ]}
              />
              {hasExam && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={onlyNoExam} onCheckedChange={setOnlyNoExam} />
                  {t("gradebook.onlyNoExam")}
                </label>
              )}
            </div>
            <SearchInput value={query} onChange={setQuery} placeholder={t("searchLearners")} className="lg:w-64" />
          </div>
          <Legend />

          {visible.length === 0 ? (
            <div className="px-4 pt-4 sm:px-5">
              <EmptyState compact icon={SearchX} title={t("learners.noMatch")} description={t("learners.noMatchText")} />
            </div>
          ) : (
            <div className={cn("report-scroll relative mt-3 overflow-auto border-t", visible.length > 12 && "max-h-[70vh]")}>
              <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                <caption className="sr-only">{t("gradebook.title")}</caption>
                <thead className="sticky top-0 z-20">
                  <tr>
                    <SortHeader
                      label={t("col.learner")}
                      active={sort.key === "name"}
                      dir={sort.dir}
                      onClick={() => toggle("name")}
                      className="sticky left-0 z-30 min-w-52 border-b bg-muted pl-4 sm:pl-5"
                    />
                    <SortHeader
                      label={t("col.completion")}
                      active={sort.key === "progress"}
                      dir={sort.dir}
                      onClick={() => toggle("progress")}
                      className="border-b bg-muted"
                      align="right"
                    />
                    <SortHeader
                      label={t("col.average")}
                      active={sort.key === "average"}
                      dir={sort.dir}
                      onClick={() => toggle("average")}
                      className="border-r border-b bg-muted"
                      align="right"
                    />
                    {columns.map((c) => (
                      <ColumnHead key={c.itemId} column={c} courseId={courseId} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="group">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b bg-card py-2 pr-3 pl-4 text-left font-normal group-hover:bg-muted sm:pl-5"
                      >
                        <Link
                          href={`/instructor/courses/${courseId}/reports/students/${r.id}`}
                          className="flex max-w-52 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <UserAvatar name={r.fullName} src={r.avatarUrl} className="size-7 print:hidden" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium hover:underline">{r.fullName}</span>
                            <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                          </span>
                        </Link>
                      </th>
                      <td className="border-b px-3 text-right tabular-nums group-hover:bg-muted/40">{f.pct0(r.progressPercent)}</td>
                      <td className="border-r border-b px-3 text-right font-medium tabular-nums group-hover:bg-muted/40">{f.pct(r.averagePercent)}</td>
                      {r.cells.map((cell, i) => (
                        <td key={cell.itemId} className="border-b px-2 py-2 text-center group-hover:bg-muted/40">
                          <Cell cell={cell} column={columns[i]} courseId={courseId} learner={r.fullName} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <StatRow label={t("gradebook.stats.average")} columns={columns} pick={(c) => f.pct(c.stats.average)} first />
                  <StatRow label={t("gradebook.stats.median")} columns={columns} pick={(c) => f.pct(c.stats.median)} />
                  <StatRow
                    label={t("gradebook.stats.range")}
                    columns={columns}
                    pick={(c) => (c.stats.min == null ? "–" : `${f.pct0(c.stats.min)} – ${f.pct0(c.stats.max)}`)}
                  />
                  <StatRow label={t("gradebook.stats.passRate")} columns={columns} pick={(c) => f.pct0(c.stats.passRate)} />
                  <StatRow label={t("gradebook.stats.attempts")} columns={columns} pick={(c) => f.num(c.stats.attempts)} />
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </ReportSection>
  );
}

function ColumnHead({ column, courseId }: { column: GradebookColumn; courseId: string }) {
  const t = useTranslations("reports");
  return (
    <th scope="col" className="min-w-32 border-b bg-muted px-2 py-2 text-center align-bottom text-xs font-medium text-muted-foreground">
      <Link
        href={`/instructor/courses/${courseId}/items/${column.itemId}?tab=analytics`}
        className="mx-auto flex max-w-36 flex-col items-center gap-1 rounded normal-case hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        title={t("gradebook.openAnalytics")}
      >
        <ItemTypeIcon type={column.type} className="size-6 print:hidden" />
        <span className="line-clamp-2 text-[13px] leading-tight text-foreground">{column.title}</span>
        <span className="text-[11px] tabular-nums">{t("gradebook.columnMeta", { points: column.maxScore, passing: column.passingScore })}</span>
      </Link>
    </th>
  );
}

function StatRow({
  label,
  columns,
  pick,
  first,
}: {
  label: string;
  columns: GradebookColumn[];
  pick: (c: GradebookColumn) => string;
  first?: boolean;
}) {
  return (
    <tr className="text-xs text-muted-foreground">
      <th
        scope="row"
        colSpan={1}
        className={cn("sticky left-0 z-10 bg-muted/90 py-1.5 pr-3 pl-4 text-left font-medium backdrop-blur sm:pl-5", first && "border-t-2")}
      >
        {label}
      </th>
      <td className={cn("bg-muted/60", first && "border-t-2")} />
      <td className={cn("border-r bg-muted/60", first && "border-t-2")} />
      {columns.map((c) => (
        <td key={c.itemId} className={cn("bg-muted/60 px-2 py-1.5 text-center tabular-nums", first && "border-t-2")}>
          {pick(c)}
        </td>
      ))}
    </tr>
  );
}

function Legend() {
  const t = useTranslations("reports");
  const items: { label: string; tone: string }[] = [
    { label: t("legend.passed"), tone: cellTone("GRADED", true) },
    { label: t("legend.failed"), tone: cellTone("GRADED", false) },
    { label: t("legend.pending"), tone: cellTone("SUBMITTED_PENDING", null) },
    { label: t("legend.inProgress"), tone: cellTone("IN_PROGRESS", null) },
    { label: t("legend.notTaken"), tone: cellTone("NOT_STARTED", null) },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 text-xs text-muted-foreground sm:px-5" aria-label={t("legend.title")}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-3 w-5 rounded-[4px] border ring-1 ring-inset", i.tone)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Cell({ cell, column, courseId, learner }: { cell: GradebookCell; column: GradebookColumn; courseId: string; learner: string }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const tone = cellTone(cell.status, cell.passed);
  const text =
    cell.status === "NOT_STARTED"
      ? t("cell.notTaken")
      : cell.bestPercent != null
        ? f.pct0(cell.bestPercent)
        : cell.status === "SUBMITTED_PENDING"
          ? t("cell.toGrade")
          : t("cell.inProgress");
  const description = [
    `${learner} · ${column.title}`,
    t(`cell.${cell.status}`),
    cell.attempts > 0 ? t("cell.attempts", { count: cell.attempts }) : null,
    cell.bestPercent != null
      ? t("cell.best", { percent: f.pct(cell.bestPercent), score: f.num(cell.bestScore), max: column.maxScore })
      : null,
    cell.passed != null ? (cell.passed ? t("legend.passed") : t("legend.failed")) : null,
    cell.lastSubmittedAt ? t("cell.submitted", { date: f.dateTime(cell.lastSubmittedAt) }) : null,
  ].filter(Boolean) as string[];
  const content = (
    <span
      className={cn(
        "inline-flex h-8 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-2 text-[13px] font-medium tabular-nums ring-1 ring-inset",
        tone,
        cell.status === "NOT_STARTED" ? "border-dashed font-normal" : "border-transparent",
        cell.status === "SUBMITTED_PENDING" && cell.bestPercent != null && "ring-2",
      )}
    >
      {text}
      {cell.status === "SUBMITTED_PENDING" && cell.bestPercent != null && <span className="size-1.5 rounded-full bg-info" aria-hidden />}
    </span>
  );
  if (!cell.latestAttemptId) {
    return (
      <Tooltip content={description.map((d, i) => <span key={i} className="block">{d}</span>)}>
        <span tabIndex={0} aria-label={description.join(", ")} className="inline-block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {content}
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={description.map((d, i) => <span key={i} className="block">{d}</span>)}>
      <Link
        href={`/instructor/courses/${courseId}/items/${column.itemId}?tab=submissions&attempt=${cell.latestAttemptId}`}
        aria-label={`${description.join(", ")}. ${t("cell.open")}`}
        className="inline-block rounded-md outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    </Tooltip>
  );
}
