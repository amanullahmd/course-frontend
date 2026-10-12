"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-segment error UI: calm, localised, never shows stack traces. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="flex min-h-[60dvh] flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-destructive-soft text-destructive">
        <TriangleAlert className="size-7" />
      </span>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("errors.title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("errors.pageText")}</p>
        {error.digest && <p className="font-mono text-xs text-muted-foreground">{t("errors.errorId", { id: error.digest })}</p>}
      </div>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCw /> {t("common.retry")}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("common.goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
