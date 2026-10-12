"use client";

import * as React from "react";
import { Check, Hourglass, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AdminUserDto } from "@/lib/api/types";
import { useInstructorDecision } from "@/hooks/queries/privacy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

/** Banner above the user list: "N instructors are waiting for approval" with a shortcut to the filter. */
export function PendingInstructorsBanner({ count, active, onShow }: { count: number; active: boolean; onShow: () => void }) {
  const t = useTranslations("security.approval");
  if (count <= 0 || active) return null;
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm">
        <Hourglass className="size-4 shrink-0 text-warning" aria-hidden />
        <span>{t("banner", { count })}</span>
      </p>
      <Button size="sm" variant="outline" onClick={onShow}>
        {t("review")}
      </Button>
    </div>
  );
}

export function InstructorStatusBadge({ user }: { user: AdminUserDto }) {
  const t = useTranslations("security.approval");
  if (user.deleted) return <Badge variant="outline">{t("deleted")}</Badge>;
  if (user.role !== "INSTRUCTOR" || !user.instructorStatus || user.instructorStatus === "APPROVED") return null;
  return user.instructorStatus === "PENDING" ? (
    <Badge variant="warning">{t("pending")}</Badge>
  ) : (
    <Badge variant="destructive">{t("rejected")}</Badge>
  );
}

/** Approve / reject buttons for instructor accounts that are not approved yet. */
export function InstructorDecisionButtons({ user }: { user: AdminUserDto }) {
  const t = useTranslations("security.approval");
  const tc = useTranslations("common");
  const decide = useInstructorDecision();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  if (user.deleted || user.role !== "INSTRUCTOR" || !user.instructorStatus || user.instructorStatus === "APPROVED") return null;

  const run = (approve: boolean) =>
    decide.mutate(
      { id: user.id, approve, reason },
      {
        onSuccess: () => {
          toast.success(approve ? t("approved", { name: user.fullName }) : t("rejectedToast", { name: user.fullName }));
          setRejecting(false);
          setReason("");
        },
      },
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="xs" onClick={() => run(true)} loading={decide.isPending && !rejecting} aria-label={t("approveName", { name: user.fullName })}>
        <Check /> {t("approve")}
      </Button>
      {user.instructorStatus === "PENDING" && (
        <Button size="xs" variant="outline" onClick={() => setRejecting(true)} aria-label={t("rejectName", { name: user.fullName })}>
          <X /> {t("reject")}
        </Button>
      )}
      <Dialog open={rejecting} onOpenChange={(open) => !decide.isPending && setRejecting(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle", { name: user.fullName })}</DialogTitle>
            <DialogDescription>{t("rejectText")}</DialogDescription>
          </DialogHeader>
          <Field label={t("reason")} htmlFor={`reason-${user.id}`} hint={t("reasonHint")}>
            <Textarea id={`reason-${user.id}`} rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)} disabled={decide.isPending}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={() => run(false)} loading={decide.isPending}>
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
