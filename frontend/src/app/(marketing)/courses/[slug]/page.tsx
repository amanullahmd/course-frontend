import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, Layers, ListChecks, ServerCrash, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { fetchPublicCourse } from "@/lib/api/server";
import { LevelBadge } from "@/components/course/badges";
import { CourseCover } from "@/components/course/course-cover";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollCard } from "@/components/course/enroll-card";
import { RichContent } from "@/components/course/rich-content";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useMinutes } from "@/hooks/use-minutes";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicCourse(slug);
  if (!result.ok) return { title: (await getTranslations("meta"))("course") };
  const description = result.data.subtitle ?? undefined;
  return {
    title: result.data.title,
    description,
    alternates: { canonical: `/courses/${slug}` },
    openGraph: { title: result.data.title, description, url: `/courses/${slug}`, images: result.data.coverImageUrl ? [result.data.coverImageUrl] : undefined },
  };
}

async function CourseDetail({ params }: { params: PageProps<"/courses/[slug]">["params"] }) {
  const { slug } = await params;
  const t = await getTranslations();
  const result = await fetchPublicCourse(slug);
  if (!result.ok && (result.status === 404 || result.status === 403)) notFound();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24">
        <EmptyState
          icon={ServerCrash}
          title={t("course.unavailableTitle")}
          description={t("course.unavailableText")}
          action={
            <Button variant="outline" asChild>
              <Link href="/courses">{t("course.backToCatalog")}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const course = result.data;
  const lessons = course.outline.reduce((n, m) => n + m.items.length, 0);
  const minutes = course.outline.reduce((n, m) => n + m.items.reduce((s, i) => s + (i.durationMinutes ?? 0), 0), 0);
  const assessments = course.outline.reduce((n, m) => n + m.items.filter((i) => i.type === "QUIZ" || i.type === "EXAM").length, 0);

  return (
    <>
      <section className="relative overflow-hidden border-b bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-35">
          <CourseCover title={course.title} src={course.coverImageUrl} level={course.level} size="lg" className="blur-sm" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <nav aria-label={t("course.breadcrumb")} className="flex items-center gap-1 text-sm text-primary-foreground/70">
            <Link href="/courses" className="hover:text-primary-foreground">
              {t("course.courses")}
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="truncate">{course.title}</span>
          </nav>
          <div className="mt-6 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={course.level} showName className="bg-white/90 dark:bg-black/50" />
              {course.tags.map((t) => (
                <span key={t} className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-primary-foreground/90 ring-1 ring-white/15">
                  {t}
                </span>
              ))}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{course.title}</h1>
            {course.subtitle && <p className="mt-4 text-lg text-primary-foreground/80">{course.subtitle}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-primary-foreground/80">
              <span className="flex items-center gap-2">
                <UserAvatar name={course.instructor.fullName} src={course.instructor.avatarUrl} className="size-7 ring-2 ring-white/20" />
                {course.instructor.fullName}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="size-4" /> {t("course.modulesCount", { count: course.moduleCount })}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {t("course.learnersCount", { count: course.studentCount })}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="order-2 flex min-w-0 flex-col gap-12 lg:order-1">
          <dl className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-4">
            {[
              { icon: Layers, label: t("course.stats.modules"), value: course.moduleCount },
              { icon: ListChecks, label: t("course.stats.lessons"), value: lessons || course.itemCount },
              { icon: Clock, label: t("course.stats.duration"), value: minutes ? <Minutes minutes={minutes} /> : t("course.stats.selfPaced") },
              { icon: ListChecks, label: t("course.stats.assessments"), value: assessments },
            ].map((s) => (
              <div key={s.label} className="min-w-0 rounded-xl border bg-card p-4">
                <dt className="flex min-w-0 items-center gap-1.5 text-xs break-words text-muted-foreground">
                  <s.icon className="size-3.5" /> {s.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          {course.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="text-xl font-semibold tracking-tight">
                {t("course.about")}
              </h2>
              <RichContent html={course.description} className="mt-4" />
            </section>
          )}

          <section aria-labelledby="outline">
            <div className="flex items-end justify-between">
              <h2 id="outline" className="text-xl font-semibold tracking-tight">
                {t("course.outline")}
              </h2>
              <span className="text-sm text-muted-foreground">
                {t("course.levelLine", { level: course.level, name: t(`levels.${course.level}.name`) })}
              </span>
            </div>
            <div className="mt-4">
              <CourseOutline modules={course.outline} />
            </div>
          </section>

          <section aria-labelledby="instructor" className="rounded-2xl border bg-card p-6">
            <h2 id="instructor" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t("course.yourInstructor")}
            </h2>
            <div className="mt-4 flex items-start gap-4">
              <UserAvatar name={course.instructor.fullName} src={course.instructor.avatarUrl} className="size-14 text-lg" />
              <div>
                <p className="text-lg font-semibold">{course.instructor.fullName}</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {course.instructor.bio || t("course.noBio")}
                </p>
              </div>
            </div>
          </section>
        </div>
        <aside className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-24">
            <EnrollCard course={course} />
          </div>
        </aside>
      </div>
    </>
  );
}

function Minutes({ minutes }: { minutes: number }) {
  return <>{useMinutes()(minutes)}</>;
}


export default function CourseDetailPage({ params }: PageProps<"/courses/[slug]">) {
  // Awaited without a Suspense boundary so unknown slugs return a real HTTP 404.
  return <CourseDetail params={params} />;
}
