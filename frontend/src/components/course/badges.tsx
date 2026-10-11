import { CalendarClock } from "lucide-react";
import type { CefrLevel, EnrollmentStatus, Visibility } from "@/lib/api/types";
import { CEFR_META, ENROLLMENT_STATUS_META, VISIBILITY_META } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function LevelBadge({ level, className, showName = false }: { level: CefrLevel; className?: string; showName?: boolean }) {
  const meta = CEFR_META[level];
  return (
    <Badge variant="plain" className={cn("font-semibold tracking-wide", meta.className, className)} title={`${level} · ${meta.name}`}>
      {level}
      {showName && <span className="font-medium opacity-80">· {meta.name}</span>}
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
  const meta = VISIBILITY_META[visibility];
  let detail: string | null = null;
  if (visibility === "SCHEDULED" && publishAt) detail = compact ? formatDate(publishAt, "d MMM") : formatDateTime(publishAt);
  if (visibility === "LIVE" && unpublishAt && !compact) detail = `until ${formatDate(unpublishAt, "d MMM")}`;
  const title = [
    meta.description,
    publishAt ? `Publish: ${formatDateTime(publishAt)}` : null,
    unpublishAt ? `Unpublish: ${formatDateTime(unpublishAt)}` : null,
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
      {meta.label}
      {detail && <span className="font-normal opacity-80">· {detail}</span>}
    </Badge>
  );
}

export function EnrollmentStatusBadge({ status, className }: { status: EnrollmentStatus; className?: string }) {
  const meta = ENROLLMENT_STATUS_META[status];
  return (
    <Badge variant="plain" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
