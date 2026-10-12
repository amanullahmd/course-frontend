"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SubmissionStatus, SubmissionSummaryDto } from "@/lib/api/types";
import { STATUS_VARIANT } from "@/lib/assignments";
import { useFormat } from "@/hooks/use-format";
import { useCourseSubmissions, useItemSubmissions } from "@/hooks/queries/practice";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReviewSheet } from "./review-sheet";

type Filter = "ALL" | SubmissionStatus;

function PointsCell({ s }: { s: SubmissionSummaryDto }) {
  return <span className="tabular-nums">{s.points !== null ? `${s.points} / ${s.maxPoints}` : "–"}</span>;
}

function QueueTable({
  rows,
  showItem,
  onSelect,
}: {
  rows: SubmissionSummaryDto[];
  showItem: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("assignments");
  const fmt = useFormat();
  return (
    <>
      {/* wide screens: table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("learner")}</TableHead>
              {showItem && <TableHead>{t("assignment")}</TableHead>}
              <TableHead>{t("submittedHeader")}</TableHead>
              <TableHead>{t("statusHeader")}</TableHead>
              <TableHead className="text-right">{t("pointsHeader")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => onSelect(s.id)}>
                <TableCell>
                  <button
                    type="button"
                    className="flex items-center gap-3 text-left outline-none focus-visible:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(s.id);
                    }}
                  >
                    <UserAvatar name={s.student.fullName} src={s.student.avatarUrl} className="size-8" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.student.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t("versionShort", { n: s.versionNo })}</span>
                    </span>
                  </button>
                </TableCell>
                {showItem && <TableCell className="max-w-56 truncate">{s.itemTitle}</TableCell>}
                <TableCell className="text-sm text-muted-foreground">
                  {fmt.dateTime(s.submittedAt)}
                  {s.late && (
                    <Badge variant="warning" className="ml-2">
                      {t("late")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status]}>{t(`status.${s.status}`)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <PointsCell s={s} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* small screens: cards */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserAvatar name={s.student.fullName} src={s.student.avatarUrl} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.student.fullName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {showItem ? `${s.itemTitle} · ` : ""}
                  {fmt.dateTime(s.submittedAt)}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={STATUS_VARIANT[s.status]}>{t(`status.${s.status}`)}</Badge>
                  {s.late && <Badge variant="warning">{t("late")}</Badge>}
                  <span className="text-xs text-muted-foreground">{t("versionShort", { n: s.versionNo })}</span>
                </span>
              </span>
              <PointsCell s={s} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function useSelectedSubmission() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("submission");
  const select = React.useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(params.toString());
      if (id) sp.set("submission", id);
      else sp.delete("submission");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [selected, select] as const;
}

function Shell({
  filter,
  setFilter,
  children,
  selected,
  select,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  children: React.ReactNode;
  selected: string | null;
  select: (id: string | null) => void;
}) {
  const t = useTranslations("assignments");
  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <Segmented<Filter>
          aria-label={t("filter")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: t("filterAll") },
            { value: "SUBMITTED", label: t("status.SUBMITTED") },
            { value: "RETURNED", label: t("status.RETURNED") },
            { value: "GRADED", label: t("status.GRADED") },
          ]}
        />
      </div>
      {children}
      <ReviewSheet submissionId={selected} onClose={() => select(null)} />
    </div>
  );
}

function Body({
  query,
  showItem,
  select,
}: {
  query: { data: SubmissionSummaryDto[] | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  showItem: boolean;
  select: (id: string | null) => void;
}) {
  const t = useTranslations("assignments");
  if (query.isPending) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];
  if (rows.length === 0) return <EmptyState icon={Inbox} title={t("queueEmptyTitle")} description={t("queueEmptyText")} />;
  return <QueueTable rows={rows} showItem={showItem} onSelect={select} />;
}

/** Review queue of one assignment item (latest version per learner). */
export function ItemSubmissionQueue({ itemId }: { itemId: string }) {
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [selected, select] = useSelectedSubmission();
  const query = useItemSubmissions(itemId, filter === "ALL" ? undefined : filter);
  return (
    <Shell filter={filter} setFilter={setFilter} selected={selected} select={select}>
      <Body query={query} showItem={false} select={select} />
    </Shell>
  );
}

/** Review queue over all assignments of a course (builder tab). */
export function CourseSubmissionQueue({ courseId }: { courseId: string }) {
  const [filter, setFilter] = React.useState<Filter>("SUBMITTED");
  const [selected, select] = useSelectedSubmission();
  const query = useCourseSubmissions(courseId, filter === "ALL" ? undefined : filter);
  return (
    <Shell filter={filter} setFilter={setFilter} selected={selected} select={select}>
      <Body query={query} showItem select={select} />
    </Shell>
  );
}
