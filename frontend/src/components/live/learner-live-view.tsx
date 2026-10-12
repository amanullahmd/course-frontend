"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarSync, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { nextSessions, pastSessions } from "@/lib/live";
import { useNow } from "@/hooks/use-now";
import { useLearnerSessions } from "@/hooks/queries/practice";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarSubscribe } from "./calendar-subscribe";
import { LiveSessionCard } from "./live-session-card";

/** /learn/[courseId]/live: next lessons with a Join button, past lessons with recordings and attendance. */
export function LearnerLiveView() {
  const { courseId } = useParams<{ courseId: string }>();
  const t = useTranslations("live");
  const sessions = useLearnerSessions(courseId);
  const now = useNow() || Date.now();
  const upcoming = React.useMemo(() => nextSessions(sessions.data ?? [], now), [sessions.data, now]);
  const past = React.useMemo(() => pastSessions(sessions.data ?? [], now), [sessions.data, now]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/learn/${courseId}`}>
          <ArrowLeft /> {t("backToCourse")}
        </Link>
      </Button>
      <h1 className="mt-3 flex items-center gap-3 text-2xl font-semibold tracking-tight">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
          <Video className="size-5" aria-hidden />
        </span>
        {t("title")}
      </h1>
      <p className="mt-2 text-muted-foreground">{t("intro")}</p>

      <Collapsible className="mt-6 rounded-xl border bg-card">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
          <CalendarSync className="size-4 text-muted-foreground" aria-hidden /> {t("subscribe")}
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t px-4 py-4">
          <CalendarSubscribe />
        </CollapsibleContent>
      </Collapsible>

      {sessions.isPending ? (
        <div className="mt-8 grid gap-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : sessions.isError ? (
        <ErrorState className="mt-8" error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : (
        <>
          <section className="mt-8" aria-labelledby="live-upcoming">
            <h2 id="live-upcoming" className="text-lg font-semibold tracking-tight">
              {t("upcoming")}
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState className="mt-3" compact icon={Video} title={t("noUpcomingTitle")} description={t("noUpcomingText")} />
            ) : (
              <ul className="mt-3 grid gap-3">
                {upcoming.map((s, i) => (
                  <li key={s.id}>
                    <LiveSessionCard session={s} highlight={i === 0} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="mt-10" aria-labelledby="live-past">
              <h2 id="live-past" className="text-lg font-semibold tracking-tight">
                {t("past")}
              </h2>
              <ul className="mt-3 grid gap-3">
                {past.map((s) => (
                  <li key={s.id}>
                    <LiveSessionCard session={s} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
