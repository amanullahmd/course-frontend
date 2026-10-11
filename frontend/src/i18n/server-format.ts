import "server-only";
import { getLocale } from "next-intl/server";
import { dateLocale, formatDate } from "@/lib/dates";

export async function getServerFormat() {
  const locale = await getLocale();
  const l = dateLocale(locale);
  return { locale, date: (v: string | null | undefined, pattern?: string) => formatDate(v, pattern, l) };
}
