"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function ErrorState({
  error,
  title,
  onRetry,
  className,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations();
  const message = useErrorMessage();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive-soft/40 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlert className="size-5" />
      </span>
      <div className="grid gap-1">
        <h3 className="font-semibold">{title ?? t("errors.loadTitle")}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{message(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
