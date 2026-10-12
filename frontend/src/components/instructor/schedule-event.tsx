import Link from "next/link";
import { CalendarClock, DoorClosed, DoorOpen, EyeOff, Layers, Library, Rocket, Video, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ScheduleEventDto } from "@/lib/api/types";
import { ITEM_TYPE_META } from "@/lib/constants";
import { dateLocale, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function eventHref(e: ScheduleEventDto): string {
  if (e.action === "OPENS" || e.action === "CLOSES") return `/instructor/courses/${e.courseId}/items/${e.entityId}?tab=assessment`;
  if (e.entityType === "SESSION") return `/instructor/courses/${e.courseId}?tab=live`;
  if (e.action === "DUE") return `/instructor/courses/${e.courseId}/items/${e.entityId}?tab=assignment`;
  if (e.entityType === "ITEM") return `/instructor/courses/${e.courseId}/items/${e.entityId}`;
  return `/instructor/courses/${e.courseId}${e.entityType === "COURSE" ? "?tab=publishing" : ""}`;
}

export function EventIcon({ event, className }: { event: ScheduleEventDto; className?: string }) {
  const Icon =
    event.entityType === "SESSION"
      ? Video
      : event.entityType === "ITEM" && event.itemType
        ? ITEM_TYPE_META[event.itemType].icon
        : event.entityType === "MODULE"
          ? Layers
          : Library;
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />;
}

type Action = ScheduleEventDto["action"];

/** Colours, icons and labels per action; OPENS/CLOSES are quiz/exam availability windows. */
export const ACTION_META: Record<Action, { chip: string; dot: string; icon: LucideIcon; label: string; verb: string }> = {
  PUBLISH: {
    chip: "bg-success-soft text-success ring-success/25 hover:bg-success/15",
    dot: "bg-success",
    icon: Rocket,
    label: "publish",
    verb: "goesLive",
  },
  UNPUBLISH: {
    chip: "bg-warning-soft text-warning ring-warning/30 hover:bg-warning/15",
    dot: "bg-warning",
    icon: EyeOff,
    label: "unpublish",
    verb: "unpublishes",
  },
  OPENS: {
    chip: "bg-info-soft text-info ring-info/25 hover:bg-info/15",
    dot: "bg-info",
    icon: DoorOpen,
    label: "windowOpens",
    verb: "attemptsOpen",
  },
  CLOSES: {
    chip: "bg-destructive-soft text-destructive ring-destructive/25 hover:bg-destructive/15",
    dot: "bg-destructive",
    icon: DoorClosed,
    label: "windowCloses",
    verb: "attemptsClose",
  },
  DUE: {
    chip: "bg-warning-soft text-warning ring-warning/30 hover:bg-warning/15",
    dot: "bg-warning",
    icon: CalendarClock,
    label: "assignmentDue",
    verb: "dueDate",
  },
  SESSION: {
    chip: "bg-brand-soft text-brand-strong ring-brand/30 hover:bg-brand/15",
    dot: "bg-brand",
    icon: Video,
    label: "liveSession",
    verb: "liveStarts",
  },
};

export const actionClass = (action: Action) => ACTION_META[action].chip;

type ActionKey = "publish" | "unpublish" | "windowOpens" | "windowCloses" | "assignmentDue" | "liveSession";
type VerbKey = "goesLive" | "unpublishes" | "attemptsOpen" | "attemptsClose" | "dueDate" | "liveStarts";

export function ActionIcon({ action, className }: { action: Action; className?: string }) {
  const Icon = ACTION_META[action].icon;
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />;
}

export function EventChip({ event, className }: { event: ScheduleEventDto; className?: string }) {
  const t = useTranslations("instructor");
  return (
    <Link
      href={eventHref(event)}
      title={`${t(ACTION_META[event.action].label as ActionKey)} · ${event.title} · ${event.courseTitle} · ${formatDate(event.at, "HH:mm")}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        actionClass(event.action),
        className,
      )}
    >
      {event.action === "OPENS" || event.action === "CLOSES" || event.action === "DUE" ? (
        <ActionIcon action={event.action} />
      ) : (
        <EventIcon event={event} />
      )}
      <span className="shrink-0 tabular-nums opacity-80">{formatDate(event.at, "HH:mm")}</span>
      <span className="truncate">{event.title}</span>
    </Link>
  );
}

export function EventRow({ event }: { event: ScheduleEventDto }) {
  const t = useTranslations("instructor");
  const l = dateLocale(useLocale());
  return (
    <Link href={eventHref(event)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", actionClass(event.action))}>
        <ActionIcon action={event.action} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          <EventIcon event={event} className="text-muted-foreground" />
          <span className="truncate">{event.title}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {t(ACTION_META[event.action].verb as VerbKey)} · {event.courseTitle}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        <span className="block font-medium text-foreground">{formatDate(event.at, "EEE d MMM", l)}</span>
        {formatDate(event.at, "HH:mm")}
      </span>
    </Link>
  );
}
