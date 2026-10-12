"use client";

import * as React from "react";
import { Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNow } from "@/hooks/use-now";
import { FormAlert } from "./auth-card";

/**
 * "Too many attempts. Try again in N seconds." with a live countdown until `until` (ms timestamp); calls `onDone`
 * once the wait is over.
 */
export function RateLimitAlert({ until, onDone }: { until: number; onDone: () => void }) {
  const t = useTranslations("security");
  const now = useNow();
  const seconds = now ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
  React.useEffect(() => {
    if (seconds === 0) onDone();
  }, [seconds, onDone]);
  return (
    <FormAlert tone="warning">
      <span className="flex items-start gap-2" aria-live="polite">
        <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{t("rateLimitedTitle")}</span>{" "}
          {seconds === null ? t("rateLimitedWait") : t("rateLimitedCountdown", { seconds: Math.max(1, seconds) })}
        </span>
      </span>
    </FormAlert>
  );
}
