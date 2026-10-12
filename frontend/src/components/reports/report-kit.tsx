"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useDownload } from "@/hooks/queries/reports";
import type { ActivityStatus, CellStatus } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { Button } from "@/components/ui/button";
import "./reports-print.css";

/** Locale-aware number helpers for reports (de: "72,5 %", en: "72.5%"); `null` renders as an en dash. */
export function useReportFormat() {
  const locale = useLocale();
  const fmt = useFormat();
  return React.useMemo(() => {
    const pct = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    });
    const pct0 = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    });
    const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return {
      ...fmt,
      pct: (v: number | null | undefined) =>
        v == null ? "–" : pct.format(v / 100),
      pct0: (v: number | null | undefined) =>
        v == null ? "–" : pct0.format(v / 100),
      num: (v: number | null | undefined) => (v == null ? "–" : num.format(v)),
      duration: (seconds: number | null | undefined) => {
        if (seconds == null) return "–";
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
        return m > 0 ? `${m} min ${s} s` : `${s} s`;
      },
    };
  }, [fmt, locale]);
}

/** Button that downloads an authenticated CSV export. */
export function DownloadButton({
  path,
  label,
  fallbackName,
  size = "sm",
  variant = "outline",
  className,
}: {
  path: string;
  label?: string;
  fallbackName?: string;
  size?: "sm" | "xs" | "default";
  variant?: "outline" | "default" | "ghost";
  className?: string;
}) {
  const t = useTranslations("reports");
  const { download, pending } = useDownload();
  const busy = pending === path;
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("print:hidden", className)}
      loading={busy}
      disabled={busy}
      aria-busy={busy}
      onClick={() => void download(path, fallbackName)}
    >
      {!busy && <Download />}{" "}
      {busy ? t("downloading") : (label ?? t("exportCsv"))}
    </Button>
  );
}

export function PrintButton({ className }: { className?: string }) {
  const t = useTranslations("reports");
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("print:hidden", className)}
      onClick={() => window.print()}
    >
      <Printer /> {t("print")}
    </Button>
  );
}

/** Header that only appears on paper: report kind, course, optional learner and the print date. */
export function PrintHeader({
  title,
  course,
  subject,
}: {
  title: string;
  course: string;
  subject?: string;
}) {
  const t = useTranslations("reports");
  const fmt = useFormat();
  return (
    <div className="print-header hidden border-b pb-3 print:block">
      <p className="text-[10pt] text-muted-foreground">
        Sprachweg · {t("printedOn", { date: fmt.dateTime(new Date()) })}
      </p>
      <h1 className="mt-1 text-[18pt] font-semibold">{title}</h1>
      <p className="text-[11pt]">
        {course}
        {subject ? ` · ${subject}` : ""}
      </p>
    </div>
  );
}

/** Visual style per gradebook cell status: passed green, failed amber/red, pending blue, not started gray. */
export function cellTone(status: CellStatus, passed: boolean | null): string {
  if (status === "SUBMITTED_PENDING")
    return "bg-info-soft text-info ring-info/30";
  if (status === "IN_PROGRESS")
    return "bg-muted text-foreground ring-border border-dashed";
  if (status === "NOT_STARTED")
    return "bg-transparent text-muted-foreground ring-border/70 border-dashed";
  if (passed) return "bg-success-soft text-success ring-success/30";
  return "bg-destructive-soft text-destructive ring-destructive/25";
}

export const ACTIVITY_TONE: Record<ActivityStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground ring-border",
  IN_PROGRESS: "bg-info-soft text-info ring-info/25",
  COMPLETED: "bg-success-soft text-success ring-success/25",
  INACTIVE: "bg-warning-soft text-warning ring-warning/30",
};

export function ActivityChip({
  status,
  className,
}: {
  status: ActivityStatus;
  className?: string;
}) {
  const t = useTranslations("reports.activity");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        ACTIVITY_TONE[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(status)}
    </span>
  );
}

/** Section card used by every report view. */
export function ReportSection({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "report-card min-w-0 rounded-xl border bg-card shadow-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div className={cn("px-4 pt-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
