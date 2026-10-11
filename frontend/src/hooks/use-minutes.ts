import { useTranslations } from "next-intl";

/** "45 min" / "1 h 30 min" (de: "45 Min." / "1 Std. 30 Min."). Works in server and client components. */
export function useMinutes() {
  const t = useTranslations("common");
  return (minutes: number | null | undefined): string => {
    if (!minutes || minutes <= 0) return "";
    if (minutes < 60) return t("minutesShort", { count: minutes });
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${t("hoursShort", { count: h })} ${t("minutesShort", { count: m })}` : t("hoursShort", { count: h });
  };
}
