"use client";

import * as React from "react";
import { CalendarSync, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { webcalUrl } from "@/lib/live";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useCalendarToken, useRotateCalendarToken } from "@/hooks/queries/practice";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** The personal iCal feed: copy the URL, open it in a calendar app, or rotate the secret. */
export function CalendarSubscribe({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("live");
  const errorMessage = useErrorMessage();
  const token = useCalendarToken();
  const rotate = useRotateCalendarToken();
  const [copied, setCopied] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);

  if (token.isPending) return <Skeleton className="h-24 rounded-xl" />;
  if (token.isError) return <ErrorState error={token.error} onRetry={() => token.refetch()} />;
  const url = token.data.url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="grid gap-3">
      {!compact && <p className="text-sm text-muted-foreground">{t("subscribeText")}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("feedUrl")} className="font-mono text-xs" />
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />} {copied ? t("copied") : t("copy")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={webcalUrl(url)}>
              <CalendarSync /> {t("openInCalendar")}
            </a>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("subscribeNote")}</p>
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)}>
          <RefreshCw /> {t("rotate")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("rotateTitle")}
        description={t("rotateText")}
        confirmLabel={t("rotateConfirm")}
        loading={rotate.isPending}
        onConfirm={() =>
          rotate.mutate(undefined, {
            onSuccess: () => {
              toast.success(t("rotated"));
              setConfirm(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}
