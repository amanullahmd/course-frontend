"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { dateLocale, formatDate, formatDateTime, formatRelative } from "@/lib/dates";

/** Locale-aware date / number formatters for client components. */
export function useFormat() {
  const locale = useLocale();
  return React.useMemo(() => {
    const l = dateLocale(locale);
    const nf = new Intl.NumberFormat(locale);
    return {
      locale,
      dateLocale: l,
      date: (v: string | Date | null | undefined, pattern?: string) => formatDate(v, pattern, l),
      dateTime: (v: string | Date | null | undefined) => formatDateTime(v, l),
      relative: (v: string | Date | null | undefined) => formatRelative(v, l),
      number: (n: number) => nf.format(n),
    };
  }, [locale]);
}
