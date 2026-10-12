import { differenceInCalendarDays, format, isValid, parseISO, type Locale } from "date-fns";

/** Compact timestamp for the conversation list: time today, "Yesterday", weekday within a week, else a date. */
export function shortStamp(iso: string | null | undefined, locale: Locale, yesterday: string): string {
  if (!iso) return "";
  const d = parseISO(iso);
  if (!isValid(d)) return "";
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return format(d, "HH:mm", { locale });
  if (days === 1) return yesterday;
  if (days < 7) return format(d, "EEE", { locale });
  return format(d, days < 300 ? "d MMM" : "d MMM yyyy", { locale });
}

/** Label of a date separator inside a thread. */
export function dayLabel(iso: string, locale: Locale, today: string, yesterday: string): string {
  const d = parseISO(iso);
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return today;
  if (days === 1) return yesterday;
  return format(d, days < 300 ? "EEEE, d MMMM" : "EEEE, d MMMM yyyy", { locale });
}

export function dayKey(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export function timeOf(iso: string, locale: Locale): string {
  return format(parseISO(iso), "HH:mm", { locale });
}
