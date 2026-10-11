export const LOCALES = ["en", "de"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
