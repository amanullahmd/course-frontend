"use client";

import * as React from "react";
import { CalendarPlus, CalendarX2, Clock, Play, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LearnerLiveSessionDto } from "@/lib/api/types";
import { countdown, formatCountdown, googleCalendarUrl, sessionState, type SessionState } from "@/lib/live";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useNow } from "@/hooks/use-now";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATE_VARIANT: Record<SessionState, "info" | "success" | "brand" | "secondary" | "destructive"> = {
  upcoming: "secondary",
  joinable: "brand",
  running: "success",
  ended: "secondary",
  cancelled: "destructive",
};

export function useSessionState(session: LearnerLiveSessionDto) {
  const now = useNow();
  return { now, state: now === 0 ? ("upcoming" as const) : sessionState(session, now) };
}

/** When and how long a session runs, in the viewer's time zone. */
export function SessionWhen({ session, className }: { session: LearnerLiveSessionDto; className?: string }) {
  const t = useTranslations("live");
  const fmt = useFormat();
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground", className)}>
      <span className="font-medium text-foreground">{fmt.date(session.startsAt, "EEEE, d MMMM")}</span>
      <span className="flex items-center gap-1 tabular-nums">
        <Clock className="size-3.5" aria-hidden /> {fmt.date(session.startsAt, "HH:mm")}–{fmt.date(session.endsAt, "HH:mm")}
      </span>
      <span>{t("minutes", { count: session.durationMinutes })}</span>
    </p>
  );
}

/** Countdown / state line of a session ("Starts in 2d 3h", "Live now", …). */
export function SessionStatusBadge({ session, state, now }: { session: LearnerLiveSessionDto; state: SessionState; now: number }) {
  const t = useTranslations("live");
  let text: string;
  if (state === "upcoming") text = t("startsIn", { time: formatCountdown(countdown(Date.parse(session.startsAt), now)) });
  else if (state === "joinable") text = t("startsSoon", { time: formatCountdown(countdown(Date.parse(session.startsAt), now)) });
  else text = t(`state.${state}`);
  return (
    <Badge variant={STATE_VARIANT[state]} aria-live={state === "joinable" ? "polite" : undefined}>
      {state === "running" && <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" aria-hidden />}
      {text}
    </Badge>
  );
}

/** Join button (only when the server revealed the link) or the time at which the link appears. */
export function JoinAction({ session, state, size = "default" }: { session: LearnerLiveSessionDto; state: SessionState; size?: "default" | "lg" | "sm" }) {
  const t = useTranslations("live");
  const fmt = useFormat();
  if (state === "cancelled" || state === "ended") return null;
  if (session.joinUrl) {
    return (
      <Button asChild size={size} variant={state === "running" ? "default" : "brand"}>
        <a href={session.joinUrl} target="_blank" rel="noopener noreferrer">
          <Video /> {t("join")}
        </a>
      </Button>
    );
  }
  return (
    <Button size={size} variant="outline" disabled>
      <Video /> {t("joinOpensAt", { time: fmt.date(session.joinOpensAt, "HH:mm") })}
    </Button>
  );
}

export function AddToCalendarLink({ session, className }: { session: LearnerLiveSessionDto; className?: string }) {
  const t = useTranslations("live");
  const href = googleCalendarUrl(session, t("calendarDetails", { course: session.courseTitle }));
  return (
    <Button variant="ghost" size="sm" asChild className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <CalendarPlus /> {t("addToCalendar")}
      </a>
    </Button>
  );
}

/** Card of one session for learners. */
export function LiveSessionCard({ session, highlight = false }: { session: LearnerLiveSessionDto; highlight?: boolean }) {
  const t = useTranslations("live");
  const { now, state } = useSessionState(session);
  const past = state === "ended" || state === "cancelled";
  return (
    <article
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-4 shadow-xs sm:p-5",
        highlight && "border-brand/40 ring-1 ring-brand/20",
        past && "bg-muted/30",
      )}
      aria-label={session.title}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={cn("min-w-0 text-base font-semibold break-words", state === "cancelled" && "line-through decoration-muted-foreground/60")}>
          {session.title}
        </h3>
        <SessionStatusBadge session={session} state={state} now={now} />
      </div>
      <SessionWhen session={session} />
      {session.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{session.description}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <JoinAction session={session} state={state} />
        {!past && <AddToCalendarLink session={session} />}
        {state === "ended" && session.recordingUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
              <Play /> {t("recording")}
            </a>
          </Button>
        )}
        {state === "cancelled" && (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
            <CalendarX2 className="size-4" aria-hidden /> {t("cancelledNote")}
          </span>
        )}
        {session.myAttendance && (
          <Badge variant={session.myAttendance === "PRESENT" ? "success" : session.myAttendance === "ABSENT" ? "destructive" : "info"} className="ml-auto">
            {t("myAttendance", { status: t(`attendance.${session.myAttendance}`) })}
          </Badge>
        )}
      </div>
    </article>
  );
}
