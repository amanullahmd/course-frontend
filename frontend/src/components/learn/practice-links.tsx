"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LearnCourseDto } from "@/lib/api/types";
import { nextSessions } from "@/lib/live";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useNow } from "@/hooks/use-now";
import { useLearnerSessions, useReviewSummary } from "@/hooks/queries/practice";

const linkClass =
  "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** Outline entries for the practice features of a course: "Review cards" (with due count) and "Live lessons". */
export function PracticeLinks({ data, onNavigate }: { data: LearnCourseDto; onNavigate?: () => void }) {
  const t = useTranslations();
  const fmt = useFormat();
  const pathname = usePathname();
  const now = useNow() || Date.now();
  const courseId = data.course.id;
  const hasDeck = data.modules.some((m) => m.items.some((i) => i.type === "FLASHCARDS"));
  const summary = useReviewSummary(hasDeck);
  const sessions = useLearnerSessions(courseId);
  const next = nextSessions(sessions.data ?? [], now)[0];
  const hasSessions = (sessions.data?.length ?? 0) > 0;
  const due = summary.data?.byCourse.find((c) => c.courseId === courseId);
  const dueCount = due ? due.due + due.newCards : 0;
  if (!hasDeck && !hasSessions) return null;
  const reviewHref = `/learn/${courseId}/review`;
  const liveHref = `/learn/${courseId}/live`;
  return (
    <>
      {hasDeck && (
        <Link
          href={reviewHref}
          onClick={onNavigate}
          aria-current={pathname === reviewHref ? "page" : undefined}
          className={cn(linkClass, pathname === reviewHref && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border")}
        >
          <span className="grid size-6 place-items-center rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-300">
            <Layers className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate">{t("flashcards.outlineEntry")}</span>
          {dueCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums">
              <span className="sr-only">{t("flashcards.cardsDue", { count: dueCount })}</span>
              <span aria-hidden>{dueCount}</span>
            </span>
          )}
        </Link>
      )}
      {hasSessions && (
        <Link
          href={liveHref}
          onClick={onNavigate}
          aria-current={pathname === liveHref ? "page" : undefined}
          className={cn(linkClass, pathname === liveHref && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border")}
        >
          <span className="grid size-6 place-items-center rounded-md bg-brand-soft text-brand-strong">
            <Video className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{t("live.outlineEntry")}</span>
            {next && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {fmt.date(next.startsAt, "EEE d MMM, HH:mm")}
              </span>
            )}
          </span>
        </Link>
      )}
    </>
  );
}
