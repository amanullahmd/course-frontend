import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";

/** Locale = NEXT_LOCALE cookie (en|de), otherwise English. No i18n routing. */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookie = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Europe/Berlin",
  };
});
