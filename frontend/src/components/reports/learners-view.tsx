"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ActivityStatus,
  Gradebook,
  GradebookRow,
} from "@/lib/api/reports";
import { reportCsv } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Meter } from "./charts";
import {
  ActivityChip,
  DownloadButton,
  ReportSection,
  useReportFormat,
} from "./report-kit";

type SortKey =
  | "name"
  | "activity"
  | "progress"
  | "lessons"
  | "quizzes"
  | "exams"
  | "quizAvg"
  | "examAvg"
  | "lastActivity";
type Sort = { key: SortKey; dir: "asc" | "desc" };
const STATUS_FILTERS: ("ALL" | ActivityStatus)[] = [
  "ALL",
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "INACTIVE",
];
const ACTIVITY_ORDER: Record<ActivityStatus, number> = {
  NOT_STARTED: 0,
  INACTIVE: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
};

function sortValue(r: GradebookRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return r.fullName.toLocaleLowerCase();
    case "activity":
      return ACTIVITY_ORDER[r.activity];
    case "progress":
      return r.progressPercent;
    case "lessons":
      return r.lessonsCompleted;
    case "quizzes":
      return r.quizzesTaken;
    case "exams":
      return r.examsTaken;
    case "quizAvg":
      return r.averageQuizPercent ?? -1;
    case "examAvg":
      return r.averageExamPercent ?? -1;
    case "lastActivity":
      return r.lastActivityAt ?? "";
  }
}

export function sortRows<K extends string>(
  rows: GradebookRow[],
  sort: { key: K; dir: "asc" | "desc" },
  value: (r: GradebookRow, k: K) => string | number,
) {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    const c =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
    return c !== 0 ? c * dir : a.fullName.localeCompare(b.fullName);
  });
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  className?: string;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "h-10 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "print-keep inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className="size-3 opacity-70 print:hidden" aria-hidden />
      </button>
    </th>
  );
}

/** Learner progress table: who did what %, with status filters, "hasn't taken" filter, search and sorting. */
export function LearnersView({
  gradebook,
  courseId,
}: {
  gradebook: Gradebook;
  courseId: string;
}) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | ActivityStatus>("ALL");
  const [missing, setMissing] = React.useState<string>("none");
  const [sort, setSort] = React.useState<Sort>({ key: "name", dir: "asc" });

  const rows = gradebook.rows;
  const columns = gradebook.columns;
  const q = query.trim().toLocaleLowerCase();
  const filtered = rows
    .filter((r) => status === "ALL" || r.activity === status)
    .filter(
      (r) =>
        !q ||
        r.fullName.toLocaleLowerCase().includes(q) ||
        r.email.toLocaleLowerCase().includes(q),
    )
    .filter((r) => {
      if (missing === "none") return true;
      if (missing === "anyExam") return r.examsTotal > 0 && r.examsTaken === 0;
      if (missing === "anyQuiz")
        return r.quizzesTotal > 0 && r.quizzesTaken === 0;
      const idx = columns.findIndex((c) => c.itemId === missing);
      return idx >= 0 && r.cells[idx].attempts === 0;
    });
  const sorted = sortRows(filtered, sort, sortValue);
  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  const head = (
    key: SortKey,
    label: string,
    className?: string,
    align?: "left" | "right",
  ) => (
    <SortHeader
      label={label}
      active={sort.key === key}
      dir={sort.dir}
      onClick={() => toggle(key)}
      className={className}
      align={align}
    />
  );
  const exams = columns.filter((c) => c.type === "EXAM");

  return (
    <ReportSection
      className="print-break-ok"
      title={t("learners.title")}
      description={t("learners.text")}
      actions={
        <DownloadButton
          path={reportCsv.progress(courseId)}
          label={t("exportProgress")}
        />
      }
      bodyClassName="px-0 sm:px-0"
    >
      {rows.length === 0 ? (
        <div className="px-4 sm:px-5">
          <EmptyState
            compact
            icon={Users}
            title={t("empty.noLearners")}
            description={t("empty.noLearnersText")}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between print:hidden">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("learners.filterStatus")}
            >
              {STATUS_FILTERS.map((s) => {
                const count =
                  s === "ALL"
                    ? rows.length
                    : rows.filter((r) => r.activity === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                      status === s &&
                        "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                    )}
                  >
                    {s === "ALL" ? t("learners.all") : t(`activity.${s}`)}
                    <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={missing} onValueChange={setMissing}>
                <SelectTrigger
                  className="sm:w-60"
                  aria-label={t("learners.notTakenFilter")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("learners.notTakenNone")}
                  </SelectItem>
                  {exams.length > 0 && (
                    <SelectItem value="anyExam">
                      {t("learners.notTakenAnyExam")}
                    </SelectItem>
                  )}
                  {columns.some((c) => c.type === "QUIZ") && (
                    <SelectItem value="anyQuiz">
                      {t("learners.notTakenAnyQuiz")}
                    </SelectItem>
                  )}
                  {columns.map((c) => (
                    <SelectItem key={c.itemId} value={c.itemId}>
                      {t("learners.notTaken", { title: c.title })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={t("searchLearners")}
                className="sm:w-60"
              />
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="px-4 sm:px-5">
              <EmptyState
                compact
                icon={SearchX}
                title={t("learners.noMatch")}
                description={t("learners.noMatchText")}
              />
            </div>
          ) : (
            <div className="report-scroll relative overflow-x-auto border-t">
              <table className="w-full min-w-[900px] text-sm">
                <caption className="sr-only">{t("learners.title")}</caption>
                <thead className="bg-muted/40">
                  <tr className="border-b">
                    {head(
                      "name",
                      t("col.learner"),
                      "sticky left-0 z-10 bg-muted pl-4 sm:pl-5",
                    )}
                    {head("activity", t("col.status"))}
                    {head("progress", t("col.completion"), "min-w-36")}
                    {head("lessons", t("col.lessons"))}
                    {head("quizzes", t("col.quizzes"))}
                    {head("exams", t("col.exams"))}
                    {head("quizAvg", t("col.quizAverage"), undefined, "right")}
                    {head("examAvg", t("col.examScore"), undefined, "right")}
                    {head(
                      "lastActivity",
                      t("col.lastActivity"),
                      "pr-4 sm:pr-5",
                      "right",
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const examCell =
                      exams.length === 1
                        ? r.cells[columns.indexOf(exams[0])]
                        : null;
                    return (
                      <tr
                        key={r.id}
                        className="group border-b last:border-0 hover:bg-muted/40"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-card py-2.5 pr-3 pl-4 text-left font-normal group-hover:bg-muted sm:pl-5"
                        >
                          <Link
                            href={`/instructor/courses/${courseId}/reports/students/${r.id}`}
                            className="flex max-w-40 sm:max-w-56 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <UserAvatar
                              name={r.fullName}
                              src={r.avatarUrl}
                              className="hidden size-8 shrink-0 sm:flex print:hidden"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium hover:underline">
                                {r.fullName}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.email}
                              </span>
                            </span>
                          </Link>
                        </th>
                        <td className="px-3">
                          <ActivityChip status={r.activity} />
                        </td>
                        <td className="px-3">
                          <div className="flex items-center gap-2">
                            <Meter
                              value={r.progressPercent}
                              className="w-24"
                              label={t("col.completion")}
                              barClassName={
                                r.progressPercent === 100
                                  ? "bg-success"
                                  : "bg-brand"
                              }
                            />
                            <span className="w-11 text-right whitespace-nowrap tabular-nums">
                              {f.pct0(r.progressPercent)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {t("learners.items", {
                              done: r.completedItems,
                              total: r.totalLiveItems,
                            })}
                          </span>
                        </td>
                        <td className="px-3 tabular-nums">
                          <Fraction
                            done={r.lessonsCompleted}
                            total={r.lessonsTotal}
                          />
                        </td>
                        <td className="px-3 tabular-nums">
                          <Fraction
                            done={r.quizzesTaken}
                            total={r.quizzesTotal}
                          />
                        </td>
                        <td className="px-3 tabular-nums">
                          <Fraction
                            done={r.examsTaken}
                            total={r.examsTotal}
                            warnIfZero
                          />
                        </td>
                        <td className="px-3 text-right tabular-nums">
                          {f.pct(r.averageQuizPercent)}
                        </td>
                        <td className="px-3 text-right whitespace-nowrap tabular-nums">
                          {r.averageExamPercent != null ? (
                            f.pct(r.averageExamPercent)
                          ) : examCell &&
                            examCell.status === "SUBMITTED_PENDING" ? (
                            <span className="text-info">
                              {t("cell.SUBMITTED_PENDING")}
                            </span>
                          ) : r.examsTotal > 0 && r.examsTaken === 0 ? (
                            <span className="text-muted-foreground">
                              {t("cell.notTaken")}
                            </span>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td
                          className="px-3 pr-4 text-right whitespace-nowrap text-muted-foreground sm:pr-5"
                          title={f.dateTime(r.lastActivityAt)}
                        >
                          {r.lastActivityAt
                            ? f.relative(r.lastActivityAt)
                            : t("learners.never")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p
            className="px-4 pt-3 text-xs text-muted-foreground sm:px-5"
            aria-live="polite"
          >
            {t("learners.showing", {
              count: sorted.length,
              total: rows.length,
            })}
          </p>
        </>
      )}
    </ReportSection>
  );
}

function Fraction({
  done,
  total,
  suffix,
  warnIfZero,
}: {
  done: number;
  total: number;
  suffix?: string;
  warnIfZero?: boolean;
}) {
  if (total === 0) return <span className="text-muted-foreground">–</span>;
  const full = done >= total;
  return (
    <span
      className={cn(
        "whitespace-nowrap",
        full && "text-success",
        warnIfZero && done === 0 && "text-warning",
      )}
    >
      <span className="font-medium">{done}</span>
      <span className="text-muted-foreground">/{total}</span>
      {suffix && (
        <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>
      )}
    </span>
  );
}
