"use client";

import * as React from "react";
import Link from "next/link";
import { Award, Check, CircleAlert, Clock, Hourglass, ListTree, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CertificateDto, CriterionDto } from "@/lib/api/certificates";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useCertificateStatus } from "@/hooks/queries/certificates";
import { useLearnContext } from "@/components/learn/learn-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CertificateActions } from "./certificate-actions";
import { CertificatePreview, type CertificatePreviewModel } from "./certificate-preview";
import { Confetti } from "./confetti";

export function previewModelOf(c: CertificateDto): CertificatePreviewModel {
  return {
    title: c.title,
    learnerName: c.learnerName,
    courseTitle: c.courseTitle,
    level: c.level,
    completedAt: c.completedAt,
    finalScore: c.finalScore,
    showScore: c.showScore,
    signerName: c.instructorName,
    signerTitle: c.signerTitle,
    organization: c.organization,
    customText: c.customText,
    signatureUrl: c.signatureImageUrl,
    code: c.code,
    verificationUrl: c.verificationUrl,
    revoked: c.status === "REVOKED",
    lang: c.language === "de" ? "de" : "en",
  };
}

function Criterion({ c }: { c: CriterionDto }) {
  const t = useTranslations("certificates");
  const fmt = useFormat();
  const pct = (v: number | null) => (v == null ? "–" : `${fmt.number(Math.round(v * 10) / 10)}%`);
  let label: string;
  let value: string;
  let ratio: number;
  if (c.key === "PROGRESS") {
    label = t("criteria.progress");
    value = `${pct(c.current)} / ${pct(c.target)}`;
    ratio = c.target ? (c.current ?? 0) / c.target : 1;
  } else if (c.key === "ASSESSMENTS_PASSED") {
    label = t("criteria.assessments");
    value = c.target === 0 ? t("criteria.noAssessments") : `${c.current ?? 0} / ${c.target}`;
    ratio = c.target ? (c.current ?? 0) / c.target : 1;
  } else {
    label = t("criteria.averageScore");
    value = `${pct(c.current)} / ${pct(c.target)}`;
    ratio = c.target ? (c.current ?? 0) / c.target : 1;
  }
  return (
    <li className="flex gap-3 py-3.5">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border",
          c.met ? "border-success bg-success text-white" : "border-input bg-card text-muted-foreground",
        )}
        aria-hidden
      >
        {c.met ? <Check className="size-3.5" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-sm font-medium">
            {label}
            <span className="sr-only"> – {c.met ? t("criteria.met") : t("criteria.notMet")}</span>
          </span>
          <span className={cn("text-sm tabular-nums", c.met ? "text-success" : "text-muted-foreground")}>{value}</span>
        </div>
        <Progress
          value={Math.min(1, Math.max(0, ratio)) * 100}
          className="mt-2 h-1.5"
          indicatorClassName={c.met ? "bg-success" : undefined}
          aria-label={label}
        />
        {c.pending > 0 && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-info">
            <Hourglass className="size-3.5" /> {t("criteria.pending", { count: c.pending })}
          </p>
        )}
      </div>
    </li>
  );
}

function IssuedCard({ certificate }: { certificate: CertificateDto }) {
  const t = useTranslations("certificates");
  const fmt = useFormat();
  const firstName = certificate.learnerName.split(" ")[0];
  const [celebrate, setCelebrate] = React.useState(false);
  React.useEffect(() => {
    // celebrate once per certificate and browser
    const key = `sw.cert.celebrated.${certificate.id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: celebrate anyway */
    }
    const id = window.setTimeout(() => setCelebrate(true), 250);
    return () => window.clearTimeout(id);
  }, [certificate.id]);

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
      <Confetti run={celebrate} />
      <div className="relative bg-[radial-gradient(120%_120%_at_50%_0%,var(--brand-soft),transparent_60%)] px-5 pt-8 pb-6 text-center sm:px-10">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#151C38] text-[#F2B544] shadow-md ring-4 ring-brand/20">
          <Award className="size-7" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{t("issuedTitle", { name: firstName })}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground text-pretty">{t("issuedText", { course: certificate.courseTitle })}</p>
      </div>
      <div className="px-4 pb-6 sm:px-8">
        <CertificatePreview model={previewModelOf(certificate)} className="mx-auto max-w-3xl" />
        <dl className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t("issuedOn")}</dt>
            <dd className="mt-0.5 font-medium">{fmt.date(certificate.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("level")}</dt>
            <dd className="mt-0.5 font-medium">{certificate.level}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("finalScore")}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {certificate.finalScore != null ? `${fmt.number(certificate.finalScore)}%` : "–"}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-muted-foreground">{t("code")}</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-medium break-all">{certificate.code}</dd>
          </div>
        </dl>
        <div className="mx-auto mt-6 max-w-3xl">
          <CertificateActions certificate={certificate} />
        </div>
      </div>
    </div>
  );
}

/** The learner's certificate page inside the course player (/learn/[courseId]/certificate). */
export function LearnerCertificateView() {
  const t = useTranslations("certificates");
  const fmt = useFormat();
  const { data, openOutline } = useLearnContext();
  const status = useCertificateStatus(data.course.id, data.progressPercent);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground lg:pl-8">
        <Award className="size-3.5" /> {t("eyebrow")}
      </div>
      {status.isPending ? (
        <div className="grid gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : status.isError ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : status.data.status === "ISSUED" && status.data.certificate ? (
        <IssuedCard certificate={status.data.certificate} />
      ) : status.data.status === "REVOKED" && status.data.certificate ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive-soft/40 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive">
              <ShieldX className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{t("revokedTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("revokedText", {
                  course: status.data.certificate.courseTitle,
                  date: fmt.date(status.data.certificate.revokedAt),
                })}
              </p>
              {status.data.certificate.revokedReason && (
                <p className="mt-3 text-sm italic">„{status.data.certificate.revokedReason}“</p>
              )}
            </div>
          </div>
        </div>
      ) : status.data.status === "NOT_ENABLED" ? (
        <EmptyState icon={Award} title={t("notEnabledTitle")} description={t("notEnabledText")} />
      ) : (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("progressTitle")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("progressText")}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <section aria-labelledby="criteria" className="rounded-xl border bg-card px-5 shadow-xs">
              <h2 id="criteria" className="sr-only">
                {t("criteria.title")}
              </h2>
              <ul className="divide-y">
                {status.data.criteria.map((c) => (
                  <Criterion key={c.key} c={c} />
                ))}
              </ul>
            </section>
            <aside className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/30 p-5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {status.data.criteriaMet ? <CircleAlert className="size-4 text-info" /> : <Clock className="size-4 text-brand-strong" />}
                {status.data.criteriaMet ? t("previewOnlyTitle") : t("nextStepsTitle")}
              </div>
              <p className="text-muted-foreground">{status.data.criteriaMet ? t("previewOnlyText") : t("nextStepsText")}</p>
              <Badge variant="brand" className="mt-1">
                <Award /> {t("autoIssued")}
              </Badge>
              <Button variant="outline" size="sm" className="mt-auto lg:hidden" onClick={openOutline}>
                <ListTree /> {t("openOutline")}
              </Button>
              <Button variant="outline" size="sm" className="hidden lg:inline-flex" asChild>
                <Link href={`/learn/${data.course.id}`}>{t("continueLearning")}</Link>
              </Button>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
