import Link from "next/link";
import { EyeOff, Layers, Library, Rocket } from "lucide-react";
import type { ScheduleEventDto } from "@/lib/api/types";
import { ITEM_TYPE_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function eventHref(e: ScheduleEventDto): string {
  if (e.entityType === "ITEM") return `/instructor/courses/${e.courseId}/items/${e.entityId}`;
  return `/instructor/courses/${e.courseId}${e.entityType === "COURSE" ? "?tab=publishing" : ""}`;
}

export function EventIcon({ event, className }: { event: ScheduleEventDto; className?: string }) {
  const Icon = event.entityType === "ITEM" && event.itemType ? ITEM_TYPE_META[event.itemType].icon : event.entityType === "MODULE" ? Layers : Library;
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-hidden />;
}

export const actionClass = (action: ScheduleEventDto["action"]) =>
  action === "PUBLISH"
    ? "bg-success-soft text-success ring-success/25 hover:bg-success/15"
    : "bg-warning-soft text-warning ring-warning/30 hover:bg-warning/15";

export function EventChip({ event, className }: { event: ScheduleEventDto; className?: string }) {
  return (
    <Link
      href={eventHref(event)}
      title={`${event.action === "PUBLISH" ? "Publish" : "Unpublish"} · ${event.title} · ${event.courseTitle} · ${formatDate(event.at, "HH:mm")}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        actionClass(event.action),
        className,
      )}
    >
      <EventIcon event={event} />
      <span className="shrink-0 tabular-nums opacity-80">{formatDate(event.at, "HH:mm")}</span>
      <span className="truncate">{event.title}</span>
    </Link>
  );
}

export function EventRow({ event }: { event: ScheduleEventDto }) {
  return (
    <Link href={eventHref(event)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", actionClass(event.action))}>
        {event.action === "PUBLISH" ? <Rocket className="size-4" /> : <EyeOff className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          <EventIcon event={event} className="text-muted-foreground" />
          <span className="truncate">{event.title}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {event.action === "PUBLISH" ? "Goes live" : "Unpublishes"} · {event.courseTitle}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        <span className="block font-medium text-foreground">{formatDate(event.at, "EEE d MMM")}</span>
        {formatDate(event.at, "HH:mm")}
      </span>
    </Link>
  );
}
