"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, Search, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { verifyPath, type VerificationDto } from "@/lib/api/certificates";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useVerifyCertificate } from "@/hooks/queries/certificates";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Outcome = "valid" | "revoked" | "notFound";

const TONE: Record<Outcome, { icon: typeof ShieldCheck; ring: string; bg: string; fg: string }> = {
  valid: { icon: ShieldCheck, ring: "ring-success/30", bg: "bg-success-soft", fg: "text-success" },
  revoked: { icon: ShieldX, ring: "ring-destructive/30", bg: "bg-destructive-soft", fg: "text-destructive" },
  notFound: { icon: ShieldQuestion, ring: "ring-border", bg: "bg-muted", fg: "text-muted-foreground" },
};

function Details({ v }: { v: VerificationDto }) {
  const t = useTranslations("certificates.verify");
  const fmt = useFormat();
  const rows: [string, React.ReactNode][] = [
    [t("learner"), <span key="n" className="font-semibold">{v.learnerName}</span>],
    [t("course"), v.courseTitle],
    [t("level"), v.level],
    [t("completedOn"), fmt.date(v.completedAt)],
    [t("issuedOn"), fmt.date(v.issuedAt)],
    [t("instructor"), v.instructorName],
    [t("organization"), v.organization || "Sprachweg"],
    [t("code"), <span key="c" className="font-mono text-[13px]">{v.code}</span>],
  ];
  if (v.revokedAt) rows.push([t("revokedOn"), <span key="r" className="text-destructive">{fmt.date(v.revokedAt)}</span>]);
  return (
    <dl className="divide-y">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-sm break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function VerifyAnother({ initial }: { initial: string }) {
  const t = useTranslations("certificates.verify");
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const code = value.trim().toUpperCase();
        if (code) router.push(verifyPath(code));
      }}
    >
      <label htmlFor="verify-code" className="sr-only">
        {t("codeLabel")}
      </label>
      <Input
        id="verify-code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="SW-2026-XXXX-XXXX-XXXX"
        className="font-mono uppercase sm:flex-1"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit" variant="outline">
        <Search /> {t("check")}
      </Button>
    </form>
  );
}

export function VerifyCertificateView({ code }: { code: string }) {
  const t = useTranslations("certificates.verify");
  const fmt = useFormat();
  const query = useVerifyCertificate(code);
  const notFound = query.isError && isApiError(query.error) && (query.error.status === 404 || query.error.status === 400);
  const outcome: Outcome | null = query.data ? (query.data.revoked ? "revoked" : "valid") : notFound ? "notFound" : null;
  const tone = outcome ? TONE[outcome] : null;

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,var(--brand-soft),transparent)]" />
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
        <p className="flex items-center justify-center gap-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          <Award className="size-3.5 text-brand-strong" /> {t("eyebrow")}
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm">
          {query.isPending ? (
            <div className="grid gap-4 p-8">
              <Skeleton className="mx-auto size-16 rounded-full" />
              <Skeleton className="mx-auto h-7 w-56" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : outcome && tone ? (
            <>
              <div className={cn("flex flex-col items-center px-6 pt-10 pb-8 text-center", outcome === "valid" && "bg-success-soft/40", outcome === "revoked" && "bg-destructive-soft/40")}>
                <div className={cn("grid size-16 place-items-center rounded-full ring-8", tone.bg, tone.fg, tone.ring)}>
                  <tone.icon className="size-8" />
                </div>
                <h1 className={cn("mt-5 text-2xl font-semibold tracking-tight sm:text-3xl", outcome !== "notFound" && tone.fg)} role="status">
                  {t(`${outcome}.title`)}
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground text-pretty">
                  {outcome === "revoked" && query.data?.revokedAt
                    ? t("revoked.text", { date: fmt.date(query.data.revokedAt) })
                    : outcome === "notFound"
                      ? t("notFound.text", { code })
                      : t("valid.text")}
                </p>
              </div>
              {query.data && (
                <div className="border-t px-6 py-2 sm:px-8">
                  <Details v={query.data} />
                </div>
              )}
            </>
          ) : (
            <div className="p-6">
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
            </div>
          )}
        </div>
        <div className="mt-8">
          <p className="mb-2 text-sm text-muted-foreground">{t("another")}</p>
          <VerifyAnother initial={outcome === "notFound" ? code : ""} />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">{t("privacy")}</p>
      </div>
    </div>
  );
}
