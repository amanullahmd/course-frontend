"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, GraduationCap, Hourglass, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { StudentEnrollmentDto } from "@/lib/api/types";
import { formatDate, formatRelative } from "@/lib/dates";
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
          <p className="text-xs text-muted-foreground">with {course.instructor.fullName}</p>
        </div>
        <div className="mt-auto grid gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{progress === 100 ? "Completed" : progress === 0 ? "Not started" : "In progress"}</span>
            <span className="font-medium tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} indicatorClassName={progress === 100 ? "bg-success" : undefined} />
        </div>
        <Button asChild size="sm" variant={progress === 0 ? "default" : "outline"}>
          <Link href={`/learn/${course.id}`}>
            {progress === 0 ? "Start course" : progress === 100 ? "Review course" : "Continue learning"} <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ApplicationRow({ enrollment, onWithdraw }: { enrollment: StudentEnrollmentDto; onWithdraw: (e: StudentEnrollmentDto) => void }) {
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
          Applied {formatDate(enrollment.appliedAt)}
          {enrollment.decidedAt && ` · decided ${formatRelative(enrollment.decidedAt)}`}
          {enrollment.status === "PENDING" && enrollment.waitlistPosition != null && (
            <>
              {" "}
              · <span className="font-medium text-foreground">#{enrollment.waitlistPosition} on the waiting list</span>
            </>
          )}
        </p>
        {enrollment.decisionReason && (enrollment.status === "REJECTED" || enrollment.status === "REVOKED") && (
          <p className="mt-1.5 text-[13px] text-muted-foreground italic">“{enrollment.decisionReason}”</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {enrollment.status === "PENDING" && (
          <Button variant="ghost" size="sm" onClick={() => onWithdraw(enrollment)}>
            Withdraw
          </Button>
        )}
        {(enrollment.status === "REJECTED" || enrollment.status === "WITHDRAWN" || enrollment.status === "REVOKED") && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/courses/${course.slug}`}>Apply again</Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export function StudentDashboard() {
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
        eyebrow="My learning"
        title={`Hallo, ${firstName}!`}
        description="Pick up where you left off, or find a new course for your level."
        actions={
          <Button variant="outline" asChild>
            <Link href="/courses">
              <Compass /> Browse courses
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active courses" value={active.length} icon={BookOpen} loading={enrollments.isPending} accent="brand" />
        <StatCard label="Pending applications" value={pending} icon={Hourglass} loading={enrollments.isPending} accent="info" />
        <StatCard label="Average progress" value={`${avg}%`} icon={TrendingUp} loading={enrollments.isPending} accent="success" />
      </div>

      {enrollments.isError ? (
        <ErrorState className="mt-10" error={enrollments.error} onRetry={() => enrollments.refetch()} />
      ) : (
        <>
          <section className="mt-10" aria-labelledby="continue">
            <h2 id="continue" className="text-lg font-semibold tracking-tight">
              Continue learning
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
                  title="No active courses yet"
                  description={
                    pending > 0
                      ? "Your applications are being reviewed. You'll get a notification as soon as you're accepted."
                      : "Find a course that matches your level and apply. Most instructors respond within a few days."
                  }
                  action={
                    <Button asChild>
                      <Link href="/courses">Find a course</Link>
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
                Applications
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
        title="Withdraw application?"
        description={toWithdraw ? `You'll leave the waiting list for “${toWithdraw.course.title}”.` : undefined}
        confirmLabel="Withdraw"
        destructive
        loading={withdraw.isPending}
        onConfirm={() => {
          if (!toWithdraw) return;
          withdraw.mutate(toWithdraw.id, {
            onSuccess: () => {
              toast.success("Application withdrawn");
              setToWithdraw(null);
            },
          });
        }}
      />
    </PageContainer>
  );
}
