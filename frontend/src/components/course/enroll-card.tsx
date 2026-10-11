"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, Hourglass, PencilLine, RotateCcw, ShieldX, Users, CircleX } from "lucide-react";
import { toast } from "sonner";
import type { CoursePublicDto } from "@/lib/api/types";
import { formatDate } from "@/lib/dates";
import { useApply, useMyEnrollment, useWithdraw } from "@/hooks/queries/student";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CourseLike = Pick<CoursePublicDto, "id" | "slug" | "title" | "enrollmentMode" | "capacity" | "studentCount" | "instructor">;

function ApplyDialog({
  course,
  open,
  onOpenChange,
}: {
  course: CourseLike;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = React.useState("");
  const apply = useApply(course.id);
  const isOpen = course.enrollmentMode === "OPEN";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isOpen ? "Join" : "Apply to"} “{course.title}”</DialogTitle>
          <DialogDescription>
            {isOpen
              ? "This course has open enrollment: you'll get access immediately."
              : "Tell the instructor a little about yourself. You'll be notified as soon as they review your application."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate(message.trim() || null, {
              onSuccess: (enrollment) => {
                onOpenChange(false);
                setMessage("");
                toast.success(
                  enrollment.status === "APPROVED" ? "You're in! Viel Erfolg." : "Application sent. We'll let you know.",
                );
              },
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="apply-message">
              Message to the instructor <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder="Hallo! I'm moving to Munich in spring and would love to reach B1 by then…"
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{message.length}/1000</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={apply.isPending}>
              {isOpen ? "Join course" : "Send application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EnrollCard({ course, className }: { course: CourseLike; className?: string }) {
  const { status, user } = useAuth();
  const enrollment = useMyEnrollment(course.id, status === "authenticated");
  const withdraw = useWithdraw(course.id);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const seatsLeft = course.capacity != null ? Math.max(0, course.capacity - course.studentCount) : null;
  const next = `/courses/${course.slug}`;

  let body: React.ReactNode;
  if (status === "loading" || (status === "authenticated" && enrollment.isPending)) {
    body = (
      <div className="grid gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  } else if (status === "unauthenticated" || !user) {
    body = (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">Create a free account or log in to apply for this course.</p>
        <Button size="lg" asChild>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            Log in to apply <ArrowRight />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </Button>
      </div>
    );
  } else if (user.id === course.instructor.id) {
    body = (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PencilLine className="size-4 text-brand-strong" /> You teach this course
        </p>
        <Button asChild>
          <Link href={`/instructor/courses/${course.id}`}>Open course builder</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/learn/${course.id}`}>Preview as student</Link>
        </Button>
      </div>
    );
  } else if (enrollment.isError) {
    body = (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">We couldn&apos;t load your enrollment status.</p>
        <Button variant="outline" onClick={() => enrollment.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else {
    const e = enrollment.data;
    switch (e?.status) {
      case "APPROVED":
        body = (
          <div className="grid gap-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CircleCheck className="size-4" /> You&apos;re enrolled
            </p>
            {e.progressPercent != null && (
              <div className="grid gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Your progress</span>
                  <span className="font-medium text-foreground tabular-nums">{Math.round(e.progressPercent)}%</span>
                </div>
                <Progress value={e.progressPercent} />
              </div>
            )}
            <Button size="lg" asChild>
              <Link href={`/learn/${course.id}`}>
                Continue learning <ArrowRight />
              </Link>
            </Button>
          </div>
        );
        break;
      case "PENDING":
        body = (
          <div className="grid gap-4">
            <div className="rounded-lg border border-info/20 bg-info-soft/50 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-info">
                <Hourglass className="size-4" /> Application pending
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Sent {formatDate(e.appliedAt)}.
                {e.waitlistPosition != null && (
                  <>
                    {" "}
                    You are <strong className="text-foreground">#{e.waitlistPosition}</strong> on the waiting list.
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              Withdraw application
            </Button>
          </div>
        );
        break;
      case "REJECTED":
      case "REVOKED":
        body = (
          <div className="grid gap-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive-soft/50 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                {e.status === "REJECTED" ? <CircleX className="size-4" /> : <ShieldX className="size-4" />}
                {e.status === "REJECTED" ? "Application not accepted" : "Access revoked"}
              </p>
              {e.decisionReason && <p className="mt-1.5 text-[13px] text-muted-foreground">“{e.decisionReason}”</p>}
            </div>
            <Button onClick={() => setApplyOpen(true)}>
              <RotateCcw /> Apply again
            </Button>
          </div>
        );
        break;
      default:
        body = (
          <div className="grid gap-3">
            {e?.status === "WITHDRAWN" && <p className="text-[13px] text-muted-foreground">You withdrew your previous application.</p>}
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={seatsLeft === 0 && course.enrollmentMode === "OPEN"}>
              {course.enrollmentMode === "OPEN" ? "Join course" : "Apply now"} <ArrowRight />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {course.enrollmentMode === "OPEN" ? "Instant access, free to join." : "The instructor reviews every application."}
            </p>
          </div>
        );
    }
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-md sm:p-6", className)}>
      <div className="mb-5 grid gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" /> Enrollment
          </span>
          <span className="font-medium">{course.enrollmentMode === "OPEN" ? "Open" : "By approval"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" /> Learners
          </span>
          <span className="font-medium tabular-nums">
            {course.studentCount}
            {course.capacity != null && <span className="text-muted-foreground"> / {course.capacity}</span>}
          </span>
        </div>
        {seatsLeft != null && (
          <p className={cn("text-xs", seatsLeft <= 3 ? "text-warning" : "text-muted-foreground")}>
            {seatsLeft === 0 ? "Fully booked: new applications join the waiting list." : `${seatsLeft} seats left`}
          </p>
        )}
      </div>
      {body}
      <ApplyDialog course={course} open={applyOpen} onOpenChange={setApplyOpen} />
      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Withdraw your application?"
        description="You'll lose your place on the waiting list. You can apply again later."
        confirmLabel="Withdraw"
        destructive
        loading={withdraw.isPending}
        onConfirm={() => {
          if (!enrollment.data) return;
          withdraw.mutate(enrollment.data.id, {
            onSuccess: () => {
              setWithdrawOpen(false);
              toast.success("Application withdrawn");
            },
          });
        }}
      />
    </div>
  );
}
