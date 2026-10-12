"use client";

import Link from "next/link";
import { ArrowRight, Layers, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { countdown, formatCountdown, sessionState } from "@/lib/live";
import { useFormat } from "@/hooks/use-format";
import { useNow } from "@/hooks/use-now";
import { useReviewSummary, useUpcomingSessions } from "@/hooks/queries/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddToCalendarLink, JoinAction } from "@/components/live/live-session-card";

function DueCardsTile() {
  const t = useTranslations("flashcards");
  const summary = useReviewSummary();
  if (summary.isPending) return <Skeleton className="h-40 rounded-xl" />;
  const data = summary.data;
  if (!data || data.dueToday === 0) return null;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs" aria-labelledby="due-tile-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300">
          <Layers className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="due-tile-title" className="text-sm font-medium text-muted-foreground">
            {t("tileTitle")}
          </h2>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{data.dueToday}</p>
          <p className="text-sm text-muted-foreground">{t("cardsDue", { count: data.dueToday })}</p>
        </div>
      </div>
      <ul className="grid gap-2">
        {data.byCourse.slice(0, 3).map((c) => (
          <li key={c.courseId} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{c.courseTitle}</span>
              <span className="text-xs text-muted-foreground">{t("tileBreakdown", { due: c.due, fresh: c.newCards })}</span>
            </span>
            <Button size="sm" asChild>
              <Link href={`/learn/${c.courseId}/review`}>
                {t("review")} <ArrowRight />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextLessonTile() {
  const t = useTranslations("live");
  const fmt = useFormat();
  const now = useNow();
  const upcoming = useUpcomingSessions();
  if (upcoming.isPending) return <Skeleton className="h-40 rounded-xl" />;
  const next = upcoming.data?.[0];
  if (!next) return null;
  const state = sessionState(next, now);
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs" aria-labelledby="live-tile-title">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <Video className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <h2 id="live-tile-title" className="text-sm font-medium text-muted-foreground">
            {t("nextLesson")}
          </h2>
          <p className="text-lg font-semibold tracking-tight break-words">{next.title}</p>
          <p className="truncate text-sm text-muted-foreground">{next.courseTitle}</p>
        </div>
        <Badge variant={state === "running" ? "success" : state === "joinable" ? "brand" : "secondary"} className="ml-auto">
          {state === "running"
            ? t("state.running")
            : t(state === "joinable" ? "startsSoon" : "startsIn", { time: formatCountdown(countdown(Date.parse(next.startsAt), now)) })}
        </Badge>
      </div>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{fmt.date(next.startsAt, "EEEE, d MMMM")}</span> · {fmt.date(next.startsAt, "HH:mm")}–{fmt.date(next.endsAt, "HH:mm")}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <JoinAction session={next} state={state} />
        <AddToCalendarLink session={next} />
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link href={`/learn/${next.courseId}/live`}>
            {t("allLessons")} <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/** Dashboard row: cards due for review and the next live lesson. Renders nothing when there is neither. */
export function PracticeTiles() {
  return (
    <div className="mt-6 grid gap-4 empty:hidden lg:grid-cols-2">
      <DueCardsTile />
      <NextLessonTile />
    </div>
  );
}
