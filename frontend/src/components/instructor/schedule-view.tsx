"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ScheduleEventDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useInstructorCourses, useSchedule } from "@/hooks/queries/instructor";
import { usePersistentState } from "@/hooks/use-local-storage";
import { useToday } from "@/hooks/use-now";
import { useFormat } from "@/hooks/use-format";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EventChip, EventRow } from "./schedule-event";


function groupByDay(events: ScheduleEventDto[]): Map<string, ScheduleEventDto[]> {
  const map = new Map<string, ScheduleEventDto[]>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = format(parseISO(e.at), "yyyy-MM-dd");
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return map;
}

function MonthGrid({ month, events, today }: { month: Date; events: ScheduleEventDto[]; today: Date | null }) {
  const t = useTranslations("instructor");
  const fmt = useFormat();
  const weekdays = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: addDays(startOfWeek(month, { weekStartsOn: 1 }), 6) });
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const byDay = groupByDay(events);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {weekdays.map((d) => (
          <div key={d.toISOString()} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
            {fmt.date(d, "EEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const list = byDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const isToday = today ? isSameDay(day, today) : false;
          return (
            <div
              key={key}
              className={cn(
                "min-h-20 border-b p-1 sm:min-h-28 sm:p-1.5",
                (i + 1) % 7 !== 0 && "border-r",
                !inMonth && "bg-muted/30",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                    !inMonth && "text-muted-foreground/60",
                    isToday && "bg-brand font-semibold text-brand-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
              {/* Mobile: dots */}
              {list.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {list.slice(0, 4).map((e) => (
                    <span key={e.id} className={cn("size-1.5 rounded-full", e.action === "PUBLISH" ? "bg-success" : "bg-warning")} />
                  ))}
                </div>
              )}
              <div className="hidden gap-1 sm:grid">
                {list.slice(0, 3).map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {list.length > 3 && (
                  <Popover>
                    <PopoverTrigger className="rounded px-1.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent">
                      {t("more", { count: list.length - 3 })}
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2">
                      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{fmt.date(day, "EEEE, d MMMM")}</p>
                      <div className="grid gap-1">
                        {list.map((e) => (
                          <EventChip key={e.id} event={e} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {list.length > 0 && (
                <Popover>
                  <PopoverTrigger className="mt-1 w-full rounded text-left text-[10px] text-muted-foreground sm:hidden" aria-label={t("eventsOn", { count: list.length, date: fmt.date(day, "d MMMM") })}>
                    {list.length}
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2">
                    <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{fmt.date(day, "EEEE, d MMMM")}</p>
                    <div className="grid gap-1">
                      {list.map((e) => (
                        <EventChip key={e.id} event={e} />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ events }: { events: ScheduleEventDto[] }) {
  const t = useTranslations("instructor");
  const fmt = useFormat();
  const byDay = groupByDay(events);
  if (events.length === 0) {
    return <EmptyState icon={CalendarDays} title={t("nothingInPeriod")} description={t("nothingInPeriodText")} />;
  }
  return (
    <div className="grid gap-6">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} aria-label={fmt.date(parseISO(day), "EEEE d MMMM")}>
          <h3 className="sticky top-14 z-10 bg-background/90 py-1.5 text-sm font-semibold backdrop-blur">
            {fmt.date(parseISO(day), "EEEE, d MMMM yyyy")}
          </h3>
          <ul className="mt-1 grid gap-0.5 rounded-xl border bg-card p-1.5">
            {list.map((e) => (
              <li key={e.id}>
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ScheduleView() {
  const t = useTranslations("instructor");
  const fmt = useFormat();
  const todayMs = useToday();
  const today = React.useMemo(() => (todayMs ? new Date(todayMs) : null), [todayMs]);
  const [offset, setOffset] = React.useState(0);
  const [view, setView] = usePersistentState<"calendar" | "agenda">("sw.schedule.view", "calendar");
  const [courseId, setCourseId] = React.useState<string>("ALL");
  const courses = useInstructorCourses();

  const month = today ? addMonths(startOfMonth(today), offset) : null;
  const range = month
    ? view === "calendar"
      ? { from: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), to: addDays(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 1) }
      : { from: startOfMonth(month), to: addMonths(startOfMonth(month), 2) }
    : null;
  const schedule = useSchedule({
    from: range?.from.toISOString(),
    to: range?.to.toISOString(),
    courseId: courseId === "ALL" ? undefined : courseId,
  });
  const events = schedule.data ?? [];

  return (
    <PageContainer wide>
      <PageHeader title={t("scheduleTitle")} description={t("scheduleText")} />
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setOffset(offset - 1)} aria-label={t("prevMonth")}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setOffset(offset + 1)} aria-label={t("nextMonth")}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
            {t("today")}
          </Button>
          <h2 className="ml-2 text-lg font-semibold tabular-nums" aria-live="polite">
            {month ? fmt.date(month, view === "calendar" ? "MMMM yyyy" : "MMMM") : ""}
            {month && view === "agenda" && ` – ${fmt.date(addMonths(month, 1), "MMMM yyyy")}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-56" size="sm" aria-label={t("filterCourse")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("allCourses")}</SelectItem>
              {(courses.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            aria-label={t("view")}
            value={view}
            onChange={setView}
            options={[
              { value: "calendar", label: t("month"), icon: <CalendarDays /> },
              { value: "agenda", label: t("agenda"), icon: <List /> },
            ]}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" /> {t("publish")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" /> {t("unpublish")}
        </span>
      </div>
      <div className={cn("mt-4 transition-opacity", schedule.isFetching && !schedule.isPending && "opacity-70")}>
        {schedule.isError ? (
          <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />
        ) : !month || schedule.isPending ? (
          <Skeleton className="h-[36rem] rounded-xl" />
        ) : view === "calendar" ? (
          <>
            <MonthGrid month={month} events={events} today={today} />
            {events.length === 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">{t("nothingInPeriod")}.</span> {t("nothingInPeriodText")}
                </span>
              </p>
            )}
          </>
        ) : (
          <Agenda events={events} />
        )}
      </div>
    </PageContainer>
  );
}
