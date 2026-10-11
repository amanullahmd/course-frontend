import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesColumn,
  ClipboardCheck,
  FileStack,
  GraduationCap,
  Layers,
  Quote,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
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
  return (
    <section className="relative overflow-hidden">
      <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pt-16 pb-24 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-32">
        <div className="animate-slide-up">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:text-foreground"
          >
            <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong">NEU</span>
            Courses from A1 to C2 are open for applications
            <ArrowRight className="size-3" />
          </Link>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Teach German your way.
            <span className="block bg-gradient-to-r from-brand-strong via-brand to-brand-strong bg-clip-text text-transparent">
              Learn it step by step.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            Sprachweg turns your PDFs, slides, recordings and quizzes into a structured course, releases each unit exactly
            when you want, and lets you hand-pick your learners.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/register?role=INSTRUCTOR">
                Start teaching <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/courses">Find a course</Link>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t pt-6">
            {[
              ["8", "content types"],
              ["A1–C2", "CEFR levels"],
              ["∞", "file formats"],
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
  return (
    <section className="border-y bg-sidebar">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Every step of the Common European Framework of Reference
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
                  <p className="text-sm font-semibold">{CEFR_META[level].name}</p>
                  <p className="text-xs text-muted-foreground italic">{CEFR_META[level].german}</p>
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
  {
    icon: Layers,
    title: "Build any course",
    body: "No fixed template. Modules hold lessons of any type, reordered with drag & drop, even across modules.",
  },
  {
    icon: FileStack,
    title: "Any file type",
    body: "PDF, Word, PowerPoint, Excel, MP3, MP4, images or ZIP. Upload with progress, preview inline, download offline.",
  },
  {
    icon: CalendarClock,
    title: "Schedule publishing",
    body: "Publish now, at a date, or for a window. Course, module and lesson each have their own Draft · Scheduled · Live state.",
  },
  {
    icon: UserCheck,
    title: "Waitlist approval",
    body: "Learners apply with a message; you approve, reject or revoke individually or in bulk while respecting capacity.",
  },
  {
    icon: ClipboardCheck,
    title: "Quizzes & exams",
    body: "Six question types, audio and image prompts for Hör- und Leseverstehen, timers, attempts and manual essay grading.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Progress tracking",
    body: "Learners see what's next and how far they've come; you see each learner's progress per course.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything a German course needs. Nothing it doesn't."
          description="Designed with DaF/DaZ teachers who run small groups and want full control over what learners see and when."
        />
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group bg-card p-7 transition-colors hover:bg-muted/30">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong transition-transform group-hover:scale-105">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const instructorSteps = [
  { icon: Layers, title: "Build", body: "Create a course, add modules and drop in your existing material." },
  { icon: CalendarClock, title: "Schedule", body: "Release one unit per week automatically, or publish everything now." },
  { icon: UserCheck, title: "Approve", body: "Review applications on your waitlist and admit learners in one click." },
];
const learnerSteps = [
  { icon: Search, title: "Discover", body: "Browse by level, read the outline and meet the instructor." },
  { icon: Send, title: "Apply", body: "Send a short message; you'll be notified as soon as you're accepted." },
  { icon: GraduationCap, title: "Learn", body: "Work through lessons, listen, read, test yourself and track progress." },
];

function StepList({ steps }: { steps: typeof instructorSteps }) {
  return (
    <ol className="mt-8 grid gap-6">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border bg-card shadow-xs">
            <s.icon className="size-4.5" />
            <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
          </span>
          <div>
            <h4 className="font-semibold">{s.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y bg-sidebar py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="Two paths, one platform" />
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-8 shadow-xs">
            <p className="text-sm font-semibold text-brand-strong">For instructors</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">From folder of files to finished course</h3>
            <StepList steps={instructorSteps} />
            <Button className="mt-8" variant="outline" asChild>
              <Link href="/register?role=INSTRUCTOR">
                Create an instructor account <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border bg-primary p-8 text-primary-foreground shadow-xs">
            <p className="text-sm font-semibold text-brand">For learners</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">A clear path from Hallo to fluent</h3>
            <div className="[&_.bg-card]:bg-primary-foreground/10 [&_.border]:border-primary-foreground/20 [&_.text-muted-foreground]:text-primary-foreground/70">
              <StepList steps={learnerSteps} />
            </div>
            <Button className="mt-8" variant="brand" asChild>
              <Link href="/courses">
                Browse courses <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const testimonials = [
  {
    quote:
      "I finally have all my PDFs, audio tracks and quizzes in one place, and each unit unlocks on Monday morning without me lifting a finger.",
    name: "Anna Weber",
    role: "Freelance DaF teacher, Leipzig",
  },
  {
    quote:
      "The listening exercises with slower playback were a game changer. I passed my B1 exam three weeks after moving to Berlin.",
    name: "Luca Bianchi",
    role: "Learner, B1",
  },
  {
    quote:
      "The waitlist keeps my groups small and personal. Approving ten learners at once takes seconds.",
    name: "Dr. Jonas Krüger",
    role: "Language school director",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Stimmen" title="Loved by teachers and learners" />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border bg-card p-7 shadow-xs">
              <Quote className="size-6 text-brand" aria-hidden />
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-6 border-t pt-4">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-16">
        <div className="absolute -top-24 left-1/2 -z-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Bereit? Your path starts here.</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/75">
            Create a free account in under a minute. Teachers can publish their first course today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="brand" asChild>
              <Link href="/register">Create free account</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link href="/courses">Explore courses</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
