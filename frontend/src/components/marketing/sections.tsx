import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesColumn,
  ClipboardCheck,
  FileStack,
  GraduationCap,
  Layers,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CEFR_LEVELS, CEFR_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductMock } from "./product-mock";

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  );
}

export function Hero() {
  const t = useTranslations("marketing");
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pt-16 pb-24 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-32">
        <div className="min-w-0 animate-slide-up">
          <Link
            href="/courses"
            className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:text-foreground"
          >
            <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong">{t("badgeNew")}</span>
            <span className="truncate">{t("badgeText")}</span>
            <ArrowRight className="size-3 shrink-0" />
          </Link>
          <h1 className="mt-6 text-[2rem] leading-tight font-semibold tracking-tight text-balance break-words hyphens-auto sm:text-5xl lg:text-6xl">
            {t("heroTitle1")}
            <span className="block bg-gradient-to-r from-brand-strong via-brand to-brand-strong bg-clip-text text-transparent">
              {t("heroTitle2")}
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            {t("heroText")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/register?role=INSTRUCTOR">
                {t("startTeaching")} <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/courses">{t("findCourse")}</Link>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t pt-6">
            {[
              ["8", t("statTypes")],
              ["A1–C2", t("statLevels")],
              ["∞", t("statFormats")],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
                <dd className="text-xs text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ProductMock />
      </div>
    </section>
  );
}

export function LevelStrip() {
  const t = useTranslations();
  return (
    <section className="border-y bg-sidebar">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          {t("marketing.levelsIntro")}
        </p>
        <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CEFR_LEVELS.map((level, i) => (
            <li key={level}>
              <Link
                href={`/courses?level=${level}`}
                className="group relative flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-md px-2 py-0.5 text-sm font-bold ring-1 ring-inset", CEFR_META[level].className)}>
                    {level}
                  </span>
                  <span className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <span key={j} className={cn("h-3 w-1 rounded-full", j <= i ? CEFR_META[level].dot : "bg-muted")} />
                    ))}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{t(`levels.${level}.name`)}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{t(`levels.${level}.description`)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const features = [
  { icon: Layers, key: "build" },
  { icon: FileStack, key: "files" },
  { icon: CalendarClock, key: "schedule" },
  { icon: UserCheck, key: "waitlist" },
  { icon: ClipboardCheck, key: "quizzes" },
  { icon: ChartNoAxesColumn, key: "progress" },
] as const;

export function Features() {
  const t = useTranslations("marketing");
  return (
    <section id="features" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t("featuresEyebrow")}
          title={t("featuresTitle")}
          description={t("featuresText")}
        />
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.key} className="group bg-card p-7 transition-colors hover:bg-muted/30">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong transition-transform group-hover:scale-105">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{t(`f.${f.key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`f.${f.key}.body`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const instructorSteps = [
  { icon: Layers, key: "build" },
  { icon: CalendarClock, key: "schedule" },
  { icon: UserCheck, key: "approve" },
] as const;
const learnerSteps = [
  { icon: Search, key: "discover" },
  { icon: Send, key: "apply" },
  { icon: GraduationCap, key: "learn" },
] as const;

function StepList({ steps }: { steps: typeof instructorSteps | typeof learnerSteps }) {
  const t = useTranslations("marketing.steps");
  return (
    <ol className="mt-8 grid gap-6">
      {steps.map((s, i) => (
        <li key={s.key} className="flex gap-4">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border bg-card shadow-xs">
            <s.icon className="size-4.5" />
            <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
          </span>
          <div>
            <h4 className="font-semibold">{t(`${s.key}.title`)}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{t(`${s.key}.body`)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  const t = useTranslations("marketing");
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y bg-sidebar py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t("howEyebrow")} title={t("howTitle")} />
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-8 shadow-xs">
            <p className="text-sm font-semibold text-brand-strong">{t("forInstructors")}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{t("instructorsTitle")}</h3>
            <StepList steps={instructorSteps} />
            <Button className="mt-8" variant="outline" asChild>
              <Link href="/register?role=INSTRUCTOR">
                {t("createInstructor")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border bg-primary p-8 text-primary-foreground shadow-xs">
            <p className="text-sm font-semibold text-brand">{t("forLearners")}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{t("learnersTitle")}</h3>
            <div className="[&_.bg-card]:bg-primary-foreground/10 [&_.border]:border-primary-foreground/20 [&_.text-muted-foreground]:text-primary-foreground/70">
              <StepList steps={learnerSteps} />
            </div>
            <Button className="mt-8" variant="brand" asChild>
              <Link href="/courses">
                {t("browseCourses")} <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const useCases = [
  { key: "weekly", icon: CalendarClock, accent: "bg-info-soft text-info" },
  { key: "groups", icon: UserCheck, accent: "bg-success-soft text-success" },
  { key: "exam", icon: ClipboardCheck, accent: "bg-brand-soft text-brand-strong" },
] as const;

/** Typical teaching scenarios Sprachweg is built for (product capabilities, not customer quotes). */
export function UseCases() {
  const t = useTranslations("marketing.useCases");
  return (
    <section className="border-y bg-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("text")} />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {useCases.map(({ key, icon: Icon, accent }) => (
            <article key={key} className="group flex flex-col rounded-2xl border bg-card p-7 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-10 place-items-center rounded-xl", accent)}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t(`${key}.audience`)}</p>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{t(`${key}.title`)}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">{t(`${key}.text`)}</p>
              <p className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                {t(`${key}.chip`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  const t = useTranslations("marketing");
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
        <div className="absolute -top-24 left-1/2 -z-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/75">
            {t("ctaText")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="brand" asChild>
              <Link href="/register">{t("ctaPrimary")}</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link href="/courses">{t("ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
