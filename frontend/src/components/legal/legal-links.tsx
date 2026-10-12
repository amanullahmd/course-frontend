import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Impressum · Datenschutz · AGB links for footers (marketing site, auth pages, app). */
export function LegalLinks({ className, separator = false }: { className?: string; separator?: boolean }) {
  const t = useTranslations("legal");
  const links = [
    { href: "/impressum", label: t("imprint") },
    { href: "/datenschutz", label: t("privacy") },
    { href: "/agb", label: t("terms") },
  ];
  return (
    <nav aria-label={t("navLabel")} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {links.map((l, i) => (
        <span key={l.href} className="flex items-center gap-x-4">
          {separator && i > 0 && <span aria-hidden>·</span>}
          <Link href={l.href} className="hover:text-foreground">
            {l.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
