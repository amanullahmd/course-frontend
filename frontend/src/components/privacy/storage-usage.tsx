"use client";

import { HardDrive } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStorageUsage } from "@/hooks/queries/privacy";
import { cn, formatBytes } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

/** Storage meter: "1.2 MB of 200 MB used". Admins (no quota) see the used amount only. */
export function StorageUsageMeter({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("privacy.storage");
  const usage = useStorageUsage();
  if (usage.isPending) return <Skeleton className={cn(compact ? "h-4 w-48" : "h-10 w-full", className)} />;
  if (usage.isError) return null;
  const { usedBytes, quotaBytes } = usage.data;
  const percent = quotaBytes ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  const tone = percent >= 95 ? "bg-destructive" : percent >= 80 ? "bg-warning" : "bg-brand";
  const label = quotaBytes
    ? t("usedOf", { used: formatBytes(usedBytes), quota: formatBytes(quotaBytes) })
    : t("usedUnlimited", { used: formatBytes(usedBytes) });
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <HardDrive className="size-3.5 shrink-0" aria-hidden />
        <span className="tabular-nums">{label}</span>
        {quotaBytes !== null && (
          <Progress value={percent} className="h-1.5 w-24" indicatorClassName={tone} aria-label={t("label")} />
        )}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <HardDrive className="size-4 text-muted-foreground" aria-hidden /> {t("label")}
        </span>
        <span className="text-muted-foreground tabular-nums">{label}</span>
      </div>
      {quotaBytes !== null && <Progress value={percent} indicatorClassName={tone} aria-label={t("label")} />}
      {quotaBytes !== null && percent >= 80 && <p className="text-xs text-warning">{t("almostFull")}</p>}
    </div>
  );
}
