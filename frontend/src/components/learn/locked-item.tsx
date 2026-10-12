"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Lock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ApiError } from "@/lib/api/client";
import type { LearnLock, LockPrerequisite } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { Button } from "@/components/ui/button";

/** Reason text for a lock, shared by the outline (one line) and the locked page. */
export function useLockText() {
  const t = useTranslations("release");
  const fmt = useFormat();
  return React.useCallback(
    (lock: LearnLock): string => {
      if (lock.reason === "DATE" && lock.unlockAt) return t("lockedUntil", { date: fmt.date(lock.unlockAt, "d MMM yyyy") });
      const list = lock.prerequisites;
      if (list.length > 1) return t("lockedPrereqMany", { count: list.length });
      const first = list[0];
      if (!first) return t("lockedTitle");
      if (lock.reason === "SEQUENCE") return t("lockedSequence", { title: first.title });
      return first.minPercent != null
        ? t("lockedPrereqMin", { title: first.title, score: t("minScore", { percent: first.minPercent }) })
        : t("lockedPrereq", { title: first.title });
    },
    [t, fmt],
  );
}

/** Reads the lock details out of a 403 ITEM_LOCKED problem. */
export function lockFromError(error: ApiError): LearnLock {
  const p = error.problem;
  return { reason: p.lockReason ?? "PREREQUISITE", unlockAt: p.unlockAt ?? null, prerequisites: p.prerequisites ?? [] };
}

function PrerequisiteLink({ courseId, p }: { courseId: string; p: LockPrerequisite }) {
  const t = useTranslations("release");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{p.title}</p>
        {p.minPercent != null && <p className="text-xs text-muted-foreground">{t("minScore", { percent: p.minPercent })}</p>}
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/learn/${courseId}/${p.itemId}`} aria-label={t("goTo", { title: p.title })}>
          {t("goTo", { title: p.title })} <ArrowRight />
        </Link>
      </Button>
    </li>
  );
}

/** Friendly state for an item that is live but not open for this learner yet (403 ITEM_LOCKED). */
export function LockedItem({
  courseId,
  title,
  lock,
  onRetry,
  checking,
}: {
  courseId: string;
  title?: string;
  lock: LearnLock;
  onRetry: () => void;
  checking?: boolean;
}) {
  const t = useTranslations("release");
  const fmt = useFormat();

  // the moment a dated lock runs out, look again
  React.useEffect(() => {
    if (lock.reason !== "DATE" || !lock.unlockAt) return;
    const wait = new Date(lock.unlockAt).getTime() - Date.now();
    if (wait <= 0 || wait > 2_000_000_000) return;
    const id = window.setTimeout(onRetry, wait + 500);
    return () => window.clearTimeout(id);
  }, [lock.reason, lock.unlockAt, onRetry]);

  const Icon = lock.reason === "DATE" ? CalendarClock : Lock;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:py-24" role="status">
      <div className="grid justify-items-center gap-4 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
          <Icon className="size-7" aria-hidden />
        </span>
        <div className="grid gap-1.5">
          {title && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{title}</p>}
          <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">{t("lockedTitle")}</h1>
        </div>
        {lock.reason === "DATE" && lock.unlockAt ? (
          <p className="text-muted-foreground">
            {t("lockedDateText", { date: fmt.dateTime(lock.unlockAt) })}
            <span className="mt-1 block text-sm">{fmt.relative(lock.unlockAt)}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">{lock.reason === "SEQUENCE" ? t("lockedSequenceText") : t("lockedPrereqText")}</p>
        )}
      </div>
      {lock.reason !== "DATE" && lock.prerequisites.length > 0 && (
        <ul className="mt-6 grid gap-2 text-left">
          {lock.prerequisites.map((p) => (
            <PrerequisiteLink key={p.itemId} courseId={courseId} p={p} />
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRetry} loading={checking}>
          <RefreshCw /> {t("checkAgain")}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/learn/${courseId}`}>{t("backToCourse")}</Link>
        </Button>
      </div>
    </div>
  );
}
