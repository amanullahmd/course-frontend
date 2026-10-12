"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Table2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCourseOverviewReport, useGradebook } from "@/hooks/queries/reports";
import { ErrorState } from "@/components/ui/error-state";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { GradebookView } from "./gradebook-view";
import { LearnersView } from "./learners-view";
import { OverviewView } from "./overview-view";
import { PrintButton, PrintHeader, useReportFormat } from "./report-kit";

const VIEWS = ["overview", "learners", "gradebook"] as const;
type View = (typeof VIEWS)[number];

export function ReportsSkeleton() {
  return (
    <div className="grid gap-4 sm:gap-6" aria-busy>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5" aria-busy>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** "Reports" tab of the course builder: overview, learner progress table and gradebook (`?tab=reports&view=`). */
export function ReportsPanel({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const t = useTranslations("reports");
  const f = useReportFormat();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "overview";
  const overview = useCourseOverviewReport(courseId, view === "overview");
  const gradebook = useGradebook(courseId, view !== "overview");

  const setView = (v: View) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "overview") sp.delete("view");
    else sp.set("view", v);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };
  const generatedAt = view === "overview" ? overview.data?.generatedAt : gradebook.data?.generatedAt;

  return (
    <div className="report-root grid gap-4 sm:gap-6">
      <PrintHeader title={t(`views.${view}`)} course={courseTitle} />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="max-w-full overflow-x-auto">
          <Segmented
            aria-label={t("views.label")}
            value={view}
            onChange={setView}
            options={[
              { value: "overview", label: t("views.overview"), icon: <LayoutDashboard /> },
              { value: "learners", label: t("views.learners"), icon: <Users /> },
              { value: "gradebook", label: t("views.gradebook"), icon: <Table2 /> },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{t("generatedAt", { when: f.dateTime(generatedAt) })}</span>
          )}
          <PrintButton />
        </div>
      </div>

      {view === "overview" ? (
        overview.isPending ? (
          <ReportsSkeleton />
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        ) : (
          <OverviewView report={overview.data} />
        )
      ) : gradebook.isPending ? (
        <TableSkeleton />
      ) : gradebook.isError ? (
        <ErrorState error={gradebook.error} onRetry={() => gradebook.refetch()} />
      ) : view === "learners" ? (
        <LearnersView gradebook={gradebook.data} courseId={courseId} />
      ) : (
        <GradebookView gradebook={gradebook.data} courseId={courseId} />
      )}
    </div>
  );
}
