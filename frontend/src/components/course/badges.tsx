import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CefrLevel, EnrollmentStatus, Visibility } from "@/lib/api/types";
import { CEFR_META, ENROLLMENT_STATUS_META, VISIBILITY_META } from "@/lib/constants";
import { dateLocale, formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function LevelBadge({ level, className, showName = false }: { level: CefrLevel; className?: string; showName?: boolean }) {
  const t = useTranslations("levels");
  const meta = CEFR_META[level];
  return (
    <Badge variant="plain" className={cn("font-semibold tracking-wide", meta.className, className)} title={`${level} · ${t(`${level}.name`)}`}>
      {level}
      {showName && <span className="font-medium opacity-80">· {t(`${level}.name`)}</span>}
    </Badge>
  );
}

export function VisibilityBadge({
  visibility,
  publishAt,
  unpublishAt,
  className,
  compact = false,
}: {
  visibility: Visibility;
  publishAt?: string | null;
  unpublishAt?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("visibility");
  const l = dateLocale(useLocale());
  const meta = VISIBILITY_META[visibility];
  let detail: string | null = null;
  if (visibility === "SCHEDULED" && publishAt) detail = compact ? formatDate(publishAt, "d MMM", l) : formatDateTime(publishAt, l);
  if (visibility === "LIVE" && unpublishAt && !compact) detail = t("until", { date: formatDate(unpublishAt, "d MMM", l) });
  const title = [
    t(`${visibility}.description`),
    publishAt ? t("publishOn", { date: formatDateTime(publishAt, l) }) : null,
    unpublishAt ? t("unpublishOn", { date: formatDateTime(unpublishAt, l) }) : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <Badge variant="plain" className={cn(meta.className, className)} title={title}>
      {visibility === "SCHEDULED" ? (
        <CalendarClock aria-hidden />
      ) : (
        <span className={cn("size-1.5 rounded-full", meta.dot, visibility === "LIVE" && "animate-pulse")} aria-hidden />
      )}
      {t(`${visibility}.label`)}
      {detail && <span className="font-normal opacity-80">· {detail}</span>}
    </Badge>
  );
}

export function EnrollmentStatusBadge({ status, className }: { status: EnrollmentStatus; className?: string }) {
  const t = useTranslations("enrollmentStatus");
  return (
    <Badge variant="plain" className={cn(ENROLLMENT_STATUS_META[status].className, className)}>
      {t(status)}
    </Badge>
  );
}
