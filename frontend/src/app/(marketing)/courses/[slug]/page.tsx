import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, Clock, Layers, ListChecks, ServerCrash, Users } from "lucide-react";
import { fetchPublicCourse } from "@/lib/api/server";
import { CEFR_META } from "@/lib/constants";
import { formatMinutes } from "@/lib/utils";
import { LevelBadge } from "@/components/course/badges";
import { CourseCover } from "@/components/course/course-cover";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollCard } from "@/components/course/enroll-card";
import { RichContent } from "@/components/course/rich-content";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchPublicCourse(slug);
  if (!result.ok) return { title: "Course" };
  return { title: result.data.title, description: result.data.subtitle ?? undefined };
}

async function CourseDetail({ params }: { params: PageProps<"/courses/[slug]">["params"] }) {
  const { slug } = await params;
  const result = await fetchPublicCourse(slug);
  if (!result.ok && (result.status === 404 || result.status === 403)) notFound();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24">
        <EmptyState
          icon={ServerCrash}
          title="This course can't be loaded right now"
          description="The course service is not responding. Please try again in a moment."
          action={
            <Button variant="outline" asChild>
              <Link href="/courses">Back to catalog</Link>
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
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-primary-foreground/70">
            <Link href="/courses" className="hover:text-primary-foreground">
              Courses
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
                <Layers className="size-4" /> {course.moduleCount} modules
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> {course.studentCount} learners
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="order-2 grid min-w-0 gap-12 lg:order-1">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Layers, label: "Modules", value: course.moduleCount },
              { icon: ListChecks, label: "Lessons", value: lessons || course.itemCount },
              { icon: Clock, label: "Duration", value: minutes ? formatMinutes(minutes) : "Self-paced" },
              { icon: ListChecks, label: "Quizzes & exams", value: assessments },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <s.icon className="size-3.5" /> {s.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          {course.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="text-xl font-semibold tracking-tight">
                About this course
              </h2>
              <RichContent html={course.description} className="mt-4" />
            </section>
          )}

          <section aria-labelledby="outline">
            <div className="flex items-end justify-between">
              <h2 id="outline" className="text-xl font-semibold tracking-tight">
                Course outline
              </h2>
              <span className="text-sm text-muted-foreground">
                Level {course.level}: {CEFR_META[course.level].name}
              </span>
            </div>
            <div className="mt-4">
              <CourseOutline modules={course.outline} />
            </div>
          </section>

          <section aria-labelledby="instructor" className="rounded-2xl border bg-card p-6">
            <h2 id="instructor" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Your instructor
            </h2>
            <div className="mt-4 flex items-start gap-4">
              <UserAvatar name={course.instructor.fullName} src={course.instructor.avatarUrl} className="size-14 text-lg" />
              <div>
                <p className="text-lg font-semibold">{course.instructor.fullName}</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {course.instructor.bio || "This instructor hasn't written a bio yet."}
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

function DetailSkeleton() {
  return (
    <>
      <div className="border-b bg-primary/95">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Skeleton className="h-4 w-32 opacity-30" />
          <Skeleton className="mt-6 h-12 w-2/3 opacity-30" />
          <Skeleton className="mt-4 h-5 w-1/2 opacity-30" />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </>
  );
}

export default function CourseDetailPage({ params }: PageProps<"/courses/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CourseDetail params={params} />
    </Suspense>
  );
}
