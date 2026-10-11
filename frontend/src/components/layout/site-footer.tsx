import Link from "next/link";
import { useTranslations } from "next-intl";
import { CEFR_LEVELS } from "@/lib/constants";
import { Logo } from "./logo";

export function SiteFooter() {
  const t = useTranslations("footer");
  const columns = [
    {
      title: t("learn"),
      links: [{ href: "/courses", label: t("catalog") }, ...CEFR_LEVELS.slice(0, 4).map((l) => ({ href: `/courses?level=${l}`, label: t("levelCourses", { level: l }) }))],
    },
    {
      title: t("teach"),
      links: [
        { href: "/register?role=INSTRUCTOR", label: t("becomeInstructor") },
        { href: "/#features", label: t("builder") },
        { href: "/#how-it-works", label: t("publishing") },
        { href: "/login", label: t("instructorLogin") },
      ],
    },
    {
      title: t("account"),
      links: [
        { href: "/login", label: t("login") },
        { href: "/register", label: t("register") },
        { href: "/forgot-password", label: t("reset") },
      ],
    },
  ];
  return (
    <footer className="border-t bg-sidebar">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="max-w-xs space-y-4">
          <Logo />
          <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          <p className="text-sm text-muted-foreground italic">{t("quote")}</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="mt-4 grid gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>{t("copyright")}</p>
          <p>{t("spirit")}</p>
        </div>
      </div>
    </footer>
  );
}
