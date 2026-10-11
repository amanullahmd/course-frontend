"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, GraduationCap, Hourglass, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { StudentEnrollmentDto } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { useMyEnrollments, useWithdraw } from "@/hooks/queries/student";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { EnrollmentStatusBadge, LevelBadge } from "@/components/course/badges";
import { CourseCover } from "@/components/course/course-cover";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

function ContinueCard({ enrollment }: { enrollment: StudentEnrollmentDto }) {
  const t = useTranslations("student");
  const { course } = enrollment;
  const progress = Math.round(enrollment.progressPercent ?? 0);
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <div className="relative aspect-[2.4/1] overflow-hidden">
        <CourseCover title={course.title} src={course.coverImageUrl} level={course.level} size="sm" />
        <LevelBadge level={course.level} className="absolute top-3 left-3 bg-white/90 dark:bg-black/60" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold">{course.title}</h3>
          <p className="text-xs text-muted-foreground">{t("withInstructor", { name: course.instructor.fullName })}</p>
        </div>
        <div className="mt-auto grid gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{progress === 100 ? t("completed") : progress === 0 ? t("notStarted") : t("inProgress")}</span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} indicatorClassName={progress === 100 ? "bg-success" : undefined} />
        </div>
        <Button asChild size="sm" variant={progress === 0 ? "default" : "outline"}>
          <Link href={`/learn/${course.id}`}>
            {progress === 0 ? t("start") : progress === 100 ? t("review") : t("continue")} <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ApplicationRow({ enrollment, onWithdraw }: { enrollment: StudentEnrollmentDto; onWithdraw: (e: StudentEnrollmentDto) => void }) {
  const t = useTranslations("student");
  const fmt = useFormat();
  const { course } = enrollment;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="size-12 shrink-0 overflow-hidden rounded-lg">
        <CourseCover title={course.title} src={course.coverImageUrl} level={course.level} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/courses/${course.slug}`} className="truncate font-medium hover:underline">
            {course.title}
          </Link>
          <EnrollmentStatusBadge status={enrollment.status} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("appliedOn", { date: fmt.date(enrollment.appliedAt) })}
          {enrollment.decidedAt && ` · ${t("decided", { when: fmt.relative(enrollment.decidedAt) })}`}
          {enrollment.status === "PENDING" && enrollment.waitlistPosition != null && (
            <>
              {" "}
              · <span className="font-medium text-foreground">{t("waitlist", { position: enrollment.waitlistPosition })}</span>
            </>
          )}
        </p>
        {enrollment.decisionReason && (enrollment.status === "REJECTED" || enrollment.status === "REVOKED") && (
          <p className="mt-1.5 text-[13px] text-muted-foreground italic">„{enrollment.decisionReason}“</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {enrollment.status === "PENDING" && (
          <Button variant="ghost" size="sm" onClick={() => onWithdraw(enrollment)}>
            {t("withdraw")}
          </Button>
        )}
        {(enrollment.status === "REJECTED" || enrollment.status === "WITHDRAWN" || enrollment.status === "REVOKED") && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/courses/${course.slug}`}>{t("applyAgain")}</Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export function StudentDashboard() {
  const t = useTranslations("student");
  const { user } = useAuth();
  const enrollments = useMyEnrollments();
  const withdraw = useWithdraw();
  const [toWithdraw, setToWithdraw] = React.useState<StudentEnrollmentDto | null>(null);

  const list = enrollments.data ?? [];
  const active = list.filter((e) => e.status === "APPROVED");
  const applications = list.filter((e) => e.status !== "APPROVED");
  const pending = list.filter((e) => e.status === "PENDING").length;
  const avg = active.length ? Math.round(active.reduce((s, e) => s + (e.progressPercent ?? 0), 0) / active.length) : 0;
  const firstName = user?.fullName.split(" ")[0] ?? "";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("hello", { name: firstName })}
        description={t("intro")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/courses">
              <Compass /> {t("browse")}
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
        <StatCard label={t("activeCourses")} value={active.length} icon={BookOpen} loading={enrollments.isPending} accent="brand" />
        <StatCard label={t("pendingApplications")} value={pending} icon={Hourglass} loading={enrollments.isPending} accent="info" />
        <StatCard label={t("avgProgress")} value={`${avg}%`} icon={TrendingUp} loading={enrollments.isPending} accent="success" className="col-span-2 sm:col-span-1" />
      </div>

      {enrollments.isError ? (
        <ErrorState className="mt-10" error={enrollments.error} onRetry={() => enrollments.refetch()} />
      ) : (
        <>
          <section className="mt-10" aria-labelledby="continue">
            <h2 id="continue" className="text-lg font-semibold tracking-tight">
              {t("continueLearning")}
            </h2>
            <div className="mt-4">
              {enrollments.isPending ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-72 rounded-xl" />
                  ))}
                </div>
              ) : active.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title={t("noActiveTitle")}
                  description={pending > 0 ? t("noActivePending") : t("noActiveText")}
                  action={
                    <Button asChild>
                      <Link href="/courses">{t("findCourse")}</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((e) => (
                    <ContinueCard key={e.id} enrollment={e} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {applications.length > 0 && (
            <section className="mt-12" aria-labelledby="applications">
              <h2 id="applications" className="text-lg font-semibold tracking-tight">
                {t("applications")}
              </h2>
              <ul className="mt-4 divide-y rounded-xl border bg-card">
                {applications.map((e) => (
                  <ApplicationRow key={e.id} enrollment={e} onWithdraw={setToWithdraw} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toWithdraw}
        onOpenChange={(o) => !o && setToWithdraw(null)}
        title={t("withdrawTitle")}
        description={toWithdraw ? t("withdrawText", { title: toWithdraw.course.title }) : undefined}
        confirmLabel={t("withdraw")}
        destructive
        loading={withdraw.isPending}
        onConfirm={() => {
          if (!toWithdraw) return;
          withdraw.mutate(toWithdraw.id, {
            onSuccess: () => {
              toast.success(t("withdrawn"));
              setToWithdraw(null);
            },
          });
        }}
      />
    </PageContainer>
  );
}
