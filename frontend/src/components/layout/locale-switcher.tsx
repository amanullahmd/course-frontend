"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { api, setApiLocale } from "@/lib/api/client";
import { LOCALES, persistLocaleCookie, type AppLocale } from "@/i18n/config";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function useSwitchLocale() {
  const router = useRouter();
  const { status } = useAuth();
  const [pending, startTransition] = React.useTransition();
  const switchTo = React.useCallback(
    (locale: AppLocale) => {
      persistLocaleCookie(locale);
      setApiLocale(locale);
      if (status === "authenticated") {
        void api.put("/api/users/me/locale", { locale }).catch(() => undefined);
      }
      startTransition(() => router.refresh());
    },
    [router, status],
  );
  return { switchTo, pending };
}

/** Compact EN | DE toggle. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const { switchTo, pending } = useSwitchLocale();
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={cn("inline-flex h-8 items-center gap-0.5 rounded-lg border bg-card p-0.5", pending && "opacity-70", className)}
    >
      <Languages className="mx-1 size-3.5 text-muted-foreground" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          aria-label={t(l)}
          onClick={() => locale !== l && switchTo(l)}
          className={cn(
            "h-full rounded-md px-2 text-xs font-semibold text-muted-foreground uppercase transition-colors hover:text-foreground",
            locale === l && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
