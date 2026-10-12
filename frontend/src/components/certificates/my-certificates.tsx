"use client";

import Link from "next/link";
import { Award, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/hooks/use-format";
import { useMyCertificates } from "@/hooks/queries/certificates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCertificateDownload } from "./certificate-actions";

/** Small "Certificate" badge for a course card when the learner holds a valid certificate for it. */
export function CertificateCourseBadge({ courseId, className }: { courseId: string; className?: string }) {
  const t = useTranslations("certificates");
  const mine = useMyCertificates();
  const has = mine.data?.some((c) => c.courseId === courseId && c.status === "ACTIVE");
  if (!has) return null;
  return (
    <Badge variant="plain" className={className ?? "bg-[#151C38] text-[#F2B544] ring-[#F2B544]/40"}>
      <Award /> {t("badge")}
    </Badge>
  );
}

/** Dashboard section listing earned certificates with download buttons (hidden when there are none). */
export function MyCertificatesSection() {
  const t = useTranslations("certificates");
  const fmt = useFormat();
  const mine = useMyCertificates();
  const { download, pending } = useCertificateDownload();
  const list = (mine.data ?? []).filter((c) => c.status === "ACTIVE");
  if (list.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="my-certificates">
      <h2 id="my-certificates" className="text-lg font-semibold tracking-tight">
        {t("myCertificates")}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {list.map((c) => (
          <li
            key={c.id}
            className="relative flex items-center gap-4 overflow-hidden rounded-xl border bg-card p-4 shadow-xs"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#F2B544] to-[#C59A45]" />
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#151C38] text-[#F2B544] ring-4 ring-brand/15">
              <Award className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/learn/${c.courseId}/certificate`} className="line-clamp-1 font-medium hover:underline">
                {c.courseTitle}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("issuedOnDate", { date: fmt.date(c.issuedAt) })} · {c.level}
                {c.finalScore != null && <> · {fmt.number(c.finalScore)}%</>}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.code}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(c.id)}
              disabled={pending === c.id}
              aria-label={t("downloadFor", { course: c.courseTitle })}
            >
              <Download /> <span className="hidden sm:inline">PDF</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
