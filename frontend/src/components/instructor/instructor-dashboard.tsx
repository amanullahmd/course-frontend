"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookCheck, CalendarDays, Check, Hourglass, Library, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import type { EnrollmentDto } from "@/lib/api/types";
import { formatRelative } from "@/lib/dates";
import { useEnrollmentActions, useInstructorDashboard } from "@/hooks/queries/instructor";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { ReasonDialog } from "@/components/builder/students-panel";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { EventRow } from "./schedule-event";

export function InstructorDashboard() {
  const { user } = useAuth();
  const dashboard = useInstructorDashboard();
  const { approve, reject } = useEnrollmentActions();
  const [rejecting, setRejecting] = React.useState<EnrollmentDto | null>(null);
  const d = dashboard.data;

  return (
    <PageContainer wide>
      <PageHeader
        eyebrow="Overview"
        title={`Guten Tag, ${user?.fullName.split(" ")[0] ?? ""}`}
        description="Here's what's happening across your courses."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/instructor/schedule">
                <CalendarDays /> Schedule
              </Link>
            </Button>
            <Button asChild>
              <Link href="/instructor/courses/new">
                <Plus /> New course
              </Link>
            </Button>
          </>
        }
      />

      {dashboard.isError ? (
        <ErrorState className="mt-8" error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Courses" value={d?.courseCount ?? 0} icon={Library} loading={dashboard.isPending} />
            <StatCard label="Live courses" value={d?.liveCourseCount ?? 0} icon={BookCheck} loading={dashboard.isPending} accent="success" />
            <StatCard label="Learners" value={d?.studentCount ?? 0} icon={Users} loading={dashboard.isPending} accent="brand" />
            <StatCard
              label="Pending applications"
              value={d?.pendingCount ?? 0}
              icon={Hourglass}
              loading={dashboard.isPending}
              accent="info"
              hint={d && d.pendingCount > 0 ? "Waiting for your decision" : undefined}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent applications</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.isPending ? (
                  <div className="grid gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : !d || d.recentApplications.length === 0 ? (
                  <EmptyState compact icon={Users} title="No new applications" description="When learners apply, you can approve them right here." />
                ) : (
                  <ul className="-mx-2 grid gap-1">
                    {d.recentApplications.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
                        <UserAvatar name={e.student.fullName} src={e.student.avatarUrl} className="size-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.student.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            <Link href={`/instructor/courses/${e.courseId}?tab=students`} className="hover:underline">
                              {e.courseTitle}
                            </Link>{" "}
                            · {formatRelative(e.appliedAt)}
                          </p>
                        </div>
                        {e.status === "PENDING" ? (
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              size="xs"
                              onClick={() => approve.mutate(e.id, { onSuccess: () => toast.success(`${e.student.fullName} approved`) })}
                              aria-label={`Approve ${e.student.fullName}`}
                            >
                              <Check /> <span className="hidden sm:inline">Approve</span>
                            </Button>
                            <Button size="xs" variant="outline" onClick={() => setRejecting(e)}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{e.status.toLowerCase()}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Upcoming schedule</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/instructor/schedule">
                    Calendar <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {dashboard.isPending ? (
                  <div className="grid gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : !d || d.upcoming.length === 0 ? (
                  <EmptyState compact icon={CalendarDays} title="Nothing scheduled" description="Schedule modules or lessons to release them automatically." />
                ) : (
                  <ul className="-mx-2 grid gap-0.5">
                    {d.upcoming.slice(0, 8).map((ev) => (
                      <li key={ev.id}>
                        <EventRow event={ev} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <ReasonDialog
        action={rejecting ? { kind: "reject", ids: [rejecting.id], names: rejecting.student.fullName } : null}
        onClose={() => setRejecting(null)}
        pending={reject.isPending}
        onConfirm={(reason) =>
          rejecting &&
          reject.mutate(
            { id: rejecting.id, reason },
            {
              onSuccess: () => {
                toast.success("Application rejected");
                setRejecting(null);
              },
            },
          )
        }
      />
    </PageContainer>
  );
}
