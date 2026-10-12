"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleCheck, CircleX, Clock, Hourglass, PencilLine, RotateCcw, ShieldX, Users } from "lucide-react";
import { toast } from "sonner";
import type { CoursePublicDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { useApply, useMyEnrollment, useWithdraw } from "@/hooks/queries/student";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MessageInstructorButton } from "@/components/messages/message-button";

type CourseLike = Pick<CoursePublicDto, "id" | "slug" | "title" | "enrollmentMode" | "capacity" | "studentCount" | "instructor">;

function ApplyDialog({ course, open, onOpenChange }: { course: CourseLike; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const [message, setMessage] = React.useState("");
  const apply = useApply(course.id);
  const submitting = React.useRef(false);
  const isOpen = course.enrollmentMode === "OPEN";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isOpen ? t("enroll.dialogJoin", { title: course.title }) : t("enroll.dialogApply", { title: course.title })}</DialogTitle>
          <DialogDescription>{isOpen ? t("enroll.dialogOpenText") : t("enroll.dialogApplyText")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            // Ignore double submits (a second request would race the first one).
            if (submitting.current) return;
            submitting.current = true;
            apply.mutate(message.trim() || null, {
              onSettled: () => {
                submitting.current = false;
              },
              onSuccess: (enrollment) => {
                onOpenChange(false);
                setMessage("");
                toast.success(enrollment.status === "APPROVED" ? t("enroll.joinedToast") : t("enroll.appliedToast"));
              },
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="apply-message">
              {t("enroll.message")} <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Textarea
              id="apply-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder={t("enroll.messagePlaceholder")}
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">{message.length}/1000</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={apply.isPending}>
              {isOpen ? t("enroll.join") : t("enroll.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EnrollCard({ course, className }: { course: CourseLike; className?: string }) {
  const t = useTranslations("enroll");
  const tc = useTranslations("common");
  const fmt = useFormat();
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
        <p className="text-sm text-muted-foreground">{t("loginHint")}</p>
        <Button size="lg" asChild>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            {t("loginToApply")} <ArrowRight />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/register?next=${encodeURIComponent(next)}`}>{t("createAccount")}</Link>
        </Button>
      </div>
    );
  } else if (user.id === course.instructor.id) {
    body = (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PencilLine className="size-4 text-brand-strong" /> {t("youTeach")}
        </p>
        <Button asChild>
          <Link href={`/instructor/courses/${course.id}`}>{t("openBuilder")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/learn/${course.id}`}>{t("previewAsStudent")}</Link>
        </Button>
      </div>
    );
  } else if (enrollment.isError) {
    body = (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">{t("statusError")}</p>
        <Button variant="outline" onClick={() => enrollment.refetch()}>
          {tc("retry")}
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
              <CircleCheck className="size-4" /> {t("enrolled")}
            </p>
            {e.progressPercent != null && (
              <div className="grid gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("yourProgress")}</span>
                  <span className="font-medium text-foreground tabular-nums">{Math.round(e.progressPercent)}%</span>
                </div>
                <Progress value={e.progressPercent} />
              </div>
            )}
            <Button size="lg" asChild>
              <Link href={`/learn/${course.id}`}>
                {t("continue")} <ArrowRight />
              </Link>
            </Button>
            <MessageInstructorButton instructor={course.instructor} course={{ id: course.id, title: course.title }} />
          </div>
        );
        break;
      case "PENDING":
        body = (
          <div className="grid gap-4">
            <div className="rounded-lg border border-info/20 bg-info-soft/50 p-3.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-info">
                <Hourglass className="size-4" /> {t("pending")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {t("sentOn", { date: fmt.date(e.appliedAt) })}
                {e.waitlistPosition != null && (
                  <>
                    {" "}
                    {t.rich("waitlistPosition", {
                      position: e.waitlistPosition,
                      b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    })}
                  </>
                )}
              </p>
            </div>
            <MessageInstructorButton instructor={course.instructor} course={{ id: course.id, title: course.title }} />
            <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
              {t("withdraw")}
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
                {e.status === "REJECTED" ? t("rejected") : t("revoked")}
              </p>
              {e.decisionReason && <p className="mt-1.5 text-[13px] text-muted-foreground">„{e.decisionReason}“</p>}
            </div>
            <Button onClick={() => setApplyOpen(true)}>
              <RotateCcw /> {t("applyAgain")}
            </Button>
          </div>
        );
        break;
      default:
        body = (
          <div className="grid gap-3">
            {e?.status === "WITHDRAWN" && <p className="text-[13px] text-muted-foreground">{t("withdrawnBefore")}</p>}
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={seatsLeft === 0 && course.enrollmentMode === "OPEN"}>
              {course.enrollmentMode === "OPEN" ? t("join") : t("applyNow")} <ArrowRight />
            </Button>
            <p className="text-center text-xs text-muted-foreground">{course.enrollmentMode === "OPEN" ? t("openHint") : t("approvalHint")}</p>
          </div>
        );
    }
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-md sm:p-6", className)}>
      <div className="mb-5 grid gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" /> {t("enrollment")}
          </span>
          <span className="font-medium">{course.enrollmentMode === "OPEN" ? t("open") : t("byApproval")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" /> {t("learners")}
          </span>
          <span className="font-medium tabular-nums">
            {course.studentCount}
            {course.capacity != null && <span className="text-muted-foreground"> / {course.capacity}</span>}
          </span>
        </div>
        {seatsLeft != null && (
          <p className={cn("text-xs", seatsLeft <= 3 ? "text-warning" : "text-muted-foreground")}>
            {seatsLeft === 0 ? t("full") : t("seatsLeft", { count: seatsLeft })}
          </p>
        )}
      </div>
      {body}
      <ApplyDialog course={course} open={applyOpen} onOpenChange={setApplyOpen} />
      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title={t("withdrawTitle")}
        description={t("withdrawText")}
        confirmLabel={t("withdrawConfirm")}
        destructive
        loading={withdraw.isPending}
        onConfirm={() => {
          if (!enrollment.data) return;
          withdraw.mutate(enrollment.data.id, {
            onSuccess: () => {
              setWithdrawOpen(false);
              toast.success(t("withdrawnToast"));
            },
          });
        }}
      />
    </div>
  );
}
