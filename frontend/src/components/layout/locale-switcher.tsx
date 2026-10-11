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

/** Compact EN | DE toggle: a radio group with roving focus (Tab enters once, arrow keys switch). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const { switchTo, pending } = useSwitchLocale();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: number | undefined;
    if (delta) next = (index + delta + LOCALES.length) % LOCALES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = LOCALES.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
    if (LOCALES[next] !== locale) switchTo(LOCALES[next]);
  };
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      aria-busy={pending || undefined}
      className={cn("inline-flex h-8 items-center gap-0.5 rounded-lg border bg-card p-0.5", pending && "opacity-70", className)}
    >
      <Languages className="mx-1 size-3.5 text-muted-foreground" aria-hidden />
      {LOCALES.map((l, i) => (
        <button
          key={l}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={locale === l}
          aria-label={t(l)}
          tabIndex={locale === l ? 0 : -1}
          onKeyDown={(e) => onKeyDown(e, i)}
          onClick={() => locale !== l && switchTo(l)}
          className={cn(
            "h-full rounded-md px-2 text-xs font-semibold text-muted-foreground uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            locale === l && "bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
