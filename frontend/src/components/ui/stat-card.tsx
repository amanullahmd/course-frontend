import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  accent = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  loading?: boolean;
  accent?: "default" | "brand" | "success" | "info" | "warning";
  className?: string;
}) {
  const accentClass = {
    default: "bg-muted text-foreground",
    brand: "bg-brand-soft text-brand-strong",
    success: "bg-success-soft text-success",
    info: "bg-info-soft text-info",
    warning: "bg-warning-soft text-warning",
  }[accent];
  return (
    <div className={cn("min-w-0 rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug font-medium break-words hyphens-auto text-muted-foreground sm:text-sm">{label}</p>
        {Icon && (
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg sm:size-8", accentClass)}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-14 sm:mt-3 sm:h-8 sm:w-16" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-3xl">{value}</p>
      )}
      {hint && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
