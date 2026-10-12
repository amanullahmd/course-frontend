"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Languages } from "lucide-react";
import { api, setApiLocale } from "@/lib/api/client";
import { LOCALES, isLocale, persistLocaleCookie, type AppLocale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** Each language is listed under its own name, so speakers of either language can always find theirs. */
const ENDONYMS: Record<AppLocale, string> = { en: "English", de: "Deutsch" };

function LocaleRadioItems({ onSelect }: { onSelect: (locale: AppLocale) => void }) {
  const locale = useLocale();
  return (
    <DropdownMenuRadioGroup value={locale} onValueChange={(value) => isLocale(value) && onSelect(value)}>
      {LOCALES.map((l) => (
        <DropdownMenuRadioItem key={l} value={l} lang={l}>
          <span className="grid h-5 w-7 place-items-center rounded border bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {l}
          </span>
          {ENDONYMS[l]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/**
 * Language dropdown. `compact` (default) shows the language code for headers;
 * `full` shows the language name, for settings pages and wide layouts.
 */
export function LocaleSwitcher({ className, variant = "compact" }: { className?: string; variant?: "compact" | "full" }) {
  const locale = useLocale();
  const t = useTranslations("locale");
  const { switchTo, pending } = useSwitchLocale();
  const current = isLocale(locale) ? locale : LOCALES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`${t("switch")}: ${ENDONYMS[current]}`}
          aria-busy={pending || undefined}
          className={cn("gap-1.5 px-2.5", pending && "opacity-70", className)}
        >
          <Languages className="text-muted-foreground" aria-hidden />
          <span className={cn(variant === "compact" && "text-xs font-semibold uppercase")}>
            {variant === "compact" ? current : ENDONYMS[current]}
          </span>
          <ChevronDown className="ml-auto size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <LocaleRadioItems onSelect={(l) => l !== current && switchTo(l)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The same choice as a submenu, for use inside another dropdown (e.g. the user menu). */
export function LocaleSubmenu() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const { switchTo } = useSwitchLocale();
  const current = isLocale(locale) ? locale : LOCALES[0];
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages /> {t("label")}
        <span className="ml-auto pl-3 text-xs text-muted-foreground">{ENDONYMS[current]}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-44">
        <LocaleRadioItems onSelect={(l) => l !== current && switchTo(l)} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
