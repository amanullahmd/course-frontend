import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { FileText, Scale, ShieldCheck, TriangleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type LegalDoc = "impressum" | "datenschutz" | "agb";

const DOCS: { doc: LegalDoc; href: string; key: "imprint" | "privacy" | "terms"; icon: typeof FileText }[] = [
  { doc: "impressum", href: "/impressum", key: "imprint", icon: FileText },
  { doc: "datenschutz", href: "/datenschutz", key: "privacy", icon: ShieldCheck },
  { doc: "agb", href: "/agb", key: "terms", icon: Scale },
];

/** The operator's legal texts live in `content/legal/<doc>.<locale>.md` (falls back to German, then English). */
async function loadLegalText(doc: LegalDoc, locale: string): Promise<string> {
  const dir = path.join(process.cwd(), "content", "legal");
  for (const candidate of [locale, "de", "en"]) {
    try {
      return await readFile(path.join(dir, `${doc}.${candidate}.md`), "utf8");
    } catch {
      /* try the next locale */
    }
  }
  return "";
}

/** True once the operator has completed and reviewed the texts (env LEGAL_PAGES_REVIEWED=true). */
function legalPagesReviewed(): boolean {
  const v = (process.env.LEGAL_PAGES_REVIEWED ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const source = await loadLegalText(doc, locale);
  const reviewed = legalPagesReviewed();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {!reviewed && (
        <div role="note" className="mb-8 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft/60 p-4 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="grid gap-1">
            <p className="font-semibold">{t("templateTitle")}</p>
            <p className="text-foreground/80">{t("templateText")}</p>
          </div>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav aria-label={t("navLabel")} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto lg:grid lg:gap-1">
            {DOCS.map(({ doc: d, href, key, icon: Icon }) => (
              <li key={d}>
                <Link
                  href={href}
                  aria-current={d === doc ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:whitespace-normal",
                    d === doc && "bg-accent font-medium text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="prose-sw max-w-3xl">
          {source ? <Markdown source={source} /> : <p>{t("missing")}</p>}
        </article>
      </div>
    </div>
  );
}

export async function legalMetadata(doc: LegalDoc) {
  const t = await getTranslations("legal");
  const key = DOCS.find((d) => d.doc === doc)!.key;
  return { title: t(key), alternates: { canonical: `/${doc}` } };
}
