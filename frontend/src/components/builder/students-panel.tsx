"use client";

import * as React from "react";
import { Check, Hourglass, MailPlus, RotateCcw, ShieldX, UserCheck, UserMinus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { EnrollmentDto, EnrollmentStatus } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useCourseEnrollments, useEnrollmentActions } from "@/hooks/queries/instructor";
import { EnrollmentStatusBadge } from "@/components/course/badges";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { AddLearnersDialog } from "./add-learners-dialog";

type Tab = "pending" | "approved" | "inactive";
const TAB_STATUSES: Record<Tab, EnrollmentStatus[]> = {
  pending: ["PENDING"],
  approved: ["APPROVED"],
  inactive: ["REJECTED", "REVOKED", "WITHDRAWN"],
};

/** On phones the three tabs share the width (labels may wrap, icons hidden) instead of scrolling sideways. */
const MOBILE_TAB = "max-sm:min-h-9 max-sm:whitespace-normal max-sm:px-1.5 max-sm:py-1 max-sm:text-[13px] max-sm:leading-tight max-sm:[&>svg]:hidden";

/** Decision reason the backend stores on enrollments created by "Add learners". */
const ADDED_BY_INSTRUCTOR = "Added by instructor";

type ReasonAction = { kind: "reject" | "revoke" | "bulk-reject" | "bulk-revoke"; ids: string[]; names: string };

export function ReasonDialog({
  action,
  onClose,
  onConfirm,
  pending,
}: {
  action: ReasonAction | null;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
  pending: boolean;
}) {
  const t = useTranslations();
  const [reason, setReason] = React.useState("");
  const revoke = action?.kind === "revoke" || action?.kind === "bulk-revoke";
  const many = action?.kind === "bulk-revoke";
  return (
    <Dialog
      open={!!action}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{revoke ? t("students.revokeTitle") : t("students.rejectTitle")}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{action?.names}</span>.{" "}
            {revoke ? (many ? t("students.revokeTextMany") : t("students.revokeText")) : t("students.rejectText")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="decision-reason">
            {t("students.reasonLabel")} <span className="font-normal text-muted-foreground">{t("students.reasonHint")}</span>
          </Label>
          <Textarea
            id="decision-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder={revoke ? t("students.revokePlaceholder") : t("students.rejectPlaceholder")}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() => {
              onConfirm(reason.trim() || null);
              setReason("");
            }}
          >
            {many ? t("students.revokeConfirm", { count: action?.ids.length ?? 0 }) : revoke ? t("students.revokeTitle") : t("students.reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A button that explains in a tooltip why it is disabled (disabled buttons get no pointer events, so wrap it). */
function GuardedButton({ blockedReason, ...props }: React.ComponentProps<typeof Button> & { blockedReason?: string | null }) {
  if (!blockedReason) return <Button {...props} />;
  return (
    <Tooltip content={blockedReason}>
      <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={blockedReason}>
        <Button {...props} disabled aria-disabled />
      </span>
    </Tooltip>
  );
}

export function StudentsPanel({ courseId, capacity }: { courseId: string; capacity: number | null }) {
  const t = useTranslations("students");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const enrollments = useCourseEnrollments(courseId);
  const { approve, reject, revoke, bulk } = useEnrollmentActions(courseId);
  const [tab, setTab] = React.useState<Tab>("pending");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reasonAction, setReasonAction] = React.useState<ReasonAction | null>(null);
  const [adding, setAdding] = React.useState(false);

  const all = enrollments.data ?? [];
  const counts = {
    pending: all.filter((e) => e.status === "PENDING").length,
    approved: all.filter((e) => e.status === "APPROVED").length,
    inactive: all.filter((e) => TAB_STATUSES.inactive.includes(e.status)).length,
  };
  const q = query.trim().toLowerCase();
  const rows = all
    .filter((e) => TAB_STATUSES[tab].includes(e.status))
    .filter((e) => !q || e.student.fullName.toLowerCase().includes(q) || e.student.email.toLowerCase().includes(q))
    .sort((a, b) =>
      tab === "pending"
        ? (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0) || a.appliedAt.localeCompare(b.appliedAt)
        : (b.decidedAt ?? b.appliedAt).localeCompare(a.decidedAt ?? a.appliedAt),
    );
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allChecked = rows.length > 0 && selectedRows.length === rows.length;
  const seatsLeft = capacity != null ? Math.max(0, capacity - counts.approved) : null;
  const full = seatsLeft != null && seatsLeft <= 0;
  const fullReason = full ? t("fullTooltip") : null;
  /** Why approving `n` more learners is not possible right now (or null). */
  const seatsBlock = (n: number) =>
    seatsLeft == null || n <= seatsLeft ? null : full ? t("fullTooltip") : t("notEnoughSeats", { selected: n, free: seatsLeft });

  const clearSelection = () => setSelected(new Set());

  // A double click must not approve the next row, which moves up under the cursor once the first one is gone.
  const approving = React.useRef(false);
  const approveOne = (e: EnrollmentDto) => {
    if (approving.current) return;
    approving.current = true;
    const restoring = e.status === "REVOKED" || e.status === "WITHDRAWN";
    approve.mutate(e.id, {
      onSuccess: () =>
        toast.success(restoring ? t("restoredToast", { name: e.student.fullName }) : t("approvedToast", { name: e.student.fullName })),
      onSettled: () => {
        window.setTimeout(() => {
          approving.current = false;
        }, 400);
      },
    });
  };

  const bulkApprove = () => {
    const ids = selectedRows.filter((r) => r.status !== "APPROVED").map((r) => r.id);
    bulk.mutate(
      { ids, action: "APPROVE", courseId },
      {
        onSuccess: (r) => {
          toast.success(tab === "inactive" ? t("bulkRestored", { count: r.length }) : t("bulkApproved", { count: r.length }));
          clearSelection();
        },
      },
    );
  };

  const renderActions = (e: EnrollmentDto) => (
    <div className="flex flex-wrap gap-1.5 sm:justify-end">
      {e.status === "PENDING" && (
        <>
          <GuardedButton size="xs" onClick={() => approveOne(e)} disabled={approve.isPending} blockedReason={fullReason}>
            <Check /> {t("approve")}
          </GuardedButton>
          <Button size="xs" variant="outline" onClick={() => setReasonAction({ kind: "reject", ids: [e.id], names: e.student.fullName })}>
            {t("reject")}
          </Button>
        </>
      )}
      {e.status === "APPROVED" && (
        <Button size="xs" variant="destructive-ghost" onClick={() => setReasonAction({ kind: "revoke", ids: [e.id], names: e.student.fullName })}>
          <UserMinus /> {t("revoke")}
        </Button>
      )}
      {e.status === "REJECTED" && (
        <GuardedButton size="xs" variant="outline" onClick={() => approveOne(e)} disabled={approve.isPending} blockedReason={fullReason}>
          <Check /> {t("approve")}
        </GuardedButton>
      )}
      {(e.status === "REVOKED" || e.status === "WITHDRAWN") && (
        <GuardedButton size="xs" variant="outline" onClick={() => approveOne(e)} disabled={approve.isPending} blockedReason={fullReason}>
          <RotateCcw /> {t("restore")}
        </GuardedButton>
      )}
    </div>
  );

  const confirmReason = (reason: string | null) => {
    if (!reasonAction) return;
    const done = () => {
      setReasonAction(null);
      clearSelection();
    };
    if (reasonAction.kind === "reject")
      reject.mutate(
        { id: reasonAction.ids[0], reason },
        {
          onSuccess: () => {
            toast.success(t("rejectedToast"));
            done();
          },
        },
      );
    else if (reasonAction.kind === "revoke")
      revoke.mutate(
        { id: reasonAction.ids[0], reason },
        {
          onSuccess: () => {
            toast.success(t("revokedToast"));
            done();
          },
        },
      );
    else {
      const revoking = reasonAction.kind === "bulk-revoke";
      bulk.mutate(
        { ids: reasonAction.ids, action: revoking ? "REVOKE" : "REJECT", reason, courseId },
        {
          onSuccess: (r) => {
            toast.success(revoking ? t("bulkRemoved", { count: r.length }) : t("bulkRejected", { count: r.length }));
            done();
          },
        },
      );
    }
  };

  const noteFor = (e: EnrollmentDto) => (tab === "inactive" ? e.decisionReason : e.message);
  const addedByInstructor = (e: EnrollmentDto) => e.status === "APPROVED" && e.decisionReason === ADDED_BY_INSTRUCTOR;

  return (
    <div className={cn("grid gap-4", selectedRows.length > 0 && "max-sm:pb-28")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
          {capacity != null ? (
            <>
              {t.rich("capacity", {
                taken: counts.approved,
                capacity,
                b: (c) => <span className="font-medium text-foreground tabular-nums">{c}</span>,
              })}
              <span className={full ? "text-warning" : undefined}> · {t("seatsLeft", { count: seatsLeft ?? 0 })}</span>
            </>
          ) : (
            enrollments.isSuccess && t("unlimited", { count: counts.approved })
          )}
        </p>
        <GuardedButton onClick={() => setAdding(true)} blockedReason={fullReason} className="max-sm:w-full">
          <MailPlus /> {t("addLearners")}
        </GuardedButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Tab);
            clearSelection();
          }}
          className="min-w-0"
        >
          <TabsList className="max-sm:grid max-sm:h-auto max-sm:w-full max-sm:grid-cols-3">
            <TabsTrigger value="pending" className={MOBILE_TAB}>
              <Hourglass /> {t("waitlist")} {counts.pending > 0 && <Badge variant="info" className="ml-0.5 px-1.5">{counts.pending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved" className={MOBILE_TAB}>
              <UserCheck /> {t("approved")} <span className="text-muted-foreground tabular-nums">{counts.approved}</span>
            </TabsTrigger>
            <TabsTrigger value="inactive" className={MOBILE_TAB}>
              <ShieldX /> {t("inactive")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder={t("search")} className="sm:w-64" />
      </div>

      {tab === "inactive" && counts.inactive > 0 && <p className="-mt-1 text-xs text-muted-foreground">{t("inactiveHint")}</p>}

      {selectedRows.length > 0 && (
        <div
          role="region"
          aria-label={t("selected", { count: selectedRows.length })}
          className="fixed inset-x-3 bottom-3 z-40 flex flex-wrap items-center gap-2 rounded-xl border border-brand/40 bg-card px-3 py-2.5 shadow-lg animate-slide-up sm:static sm:gap-3 sm:bg-brand-soft/40 sm:px-4 sm:shadow-none"
        >
          <span className="text-sm font-medium">{t("selected", { count: selectedRows.length })}</span>
          <Button size="sm" variant="ghost" className="ml-auto sm:order-last" onClick={clearSelection}>
            {tc("clear")}
          </Button>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:max-sm:flex-1">
          {tab === "pending" && (
            <>
              <GuardedButton size="sm" loading={bulk.isPending && !reasonAction} onClick={bulkApprove} blockedReason={seatsBlock(selectedRows.length)}>
                <Check /> {t("approveSelected")}
              </GuardedButton>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setReasonAction({ kind: "bulk-reject", ids: selectedRows.map((r) => r.id), names: t("applicationsCount", { count: selectedRows.length }) })
                }
              >
                <X /> {t("rejectSelected")}
              </Button>
            </>
          )}
          {tab === "approved" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setReasonAction({ kind: "bulk-revoke", ids: selectedRows.map((r) => r.id), names: t("learnersCount", { count: selectedRows.length }) })
              }
            >
              <UserMinus /> {t("removeSelected")}
            </Button>
          )}
          {tab === "inactive" && (
            <GuardedButton size="sm" loading={bulk.isPending} onClick={bulkApprove} blockedReason={seatsBlock(selectedRows.length)}>
              <RotateCcw /> {t("restoreSelected")}
            </GuardedButton>
          )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {enrollments.isPending ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : enrollments.isError ? (
          <ErrorState className="m-4" error={enrollments.error} onRetry={() => enrollments.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            className="m-4 border-none"
            icon={Users}
            title={q ? t("noMatch") : tab === "pending" ? t("noPending") : tab === "approved" ? t("noApproved") : t("nothing")}
            description={tab === "pending" && !q ? t("pendingHint") : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked ? true : selectedRows.length > 0 ? "indeterminate" : false}
                    onCheckedChange={(c) => setSelected(c === true ? new Set(rows.map((r) => r.id)) : new Set())}
                    aria-label={tc("selectAll")}
                  />
                </TableHead>
                {tab === "pending" && <TableHead className="w-12">#</TableHead>}
                <TableHead>{t("learner")}</TableHead>
                <TableHead className="hidden md:table-cell">{tab === "inactive" ? t("reason") : t("message")}</TableHead>
                <TableHead className="hidden sm:table-cell">{tab === "pending" ? t("applied") : tab === "approved" ? t("progress") : t("status")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const note = addedByInstructor(e) ? null : noteFor(e);
                return (
                  <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                    <TableCell className="align-top sm:align-middle">
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={(c) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (c === true) next.add(e.id);
                            else next.delete(e.id);
                            return next;
                          })
                        }
                        aria-label={t("selectLearner", { name: e.student.fullName })}
                        className="max-sm:mt-2"
                      />
                    </TableCell>
                    {tab === "pending" && <TableCell className="font-medium text-muted-foreground tabular-nums">{e.waitlistPosition ?? "–"}</TableCell>}
                    <TableCell className="max-w-0 sm:max-w-none">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={e.student.fullName} src={e.student.avatarUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.student.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.student.email}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                        {tab === "inactive" && <EnrollmentStatusBadge status={e.status} />}
                        {tab === "approved" && (
                          <div className="flex w-28 items-center gap-2">
                            <Progress value={e.progressPercent ?? 0} className="h-1.5" />
                            <span className="text-xs tabular-nums">{Math.round(e.progressPercent ?? 0)}%</span>
                          </div>
                        )}
                        {addedByInstructor(e) && <Badge variant="brand">{t("addedByYou")}</Badge>}
                      </div>
                      {note && <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground md:hidden">{note}</p>}
                      <div className="mt-2.5 sm:hidden">{renderActions(e)}</div>
                    </TableCell>
                    <TableCell className="hidden max-w-xs md:table-cell">
                      {addedByInstructor(e) ? (
                        <Badge variant="brand">{t("addedByYou")}</Badge>
                      ) : note ? (
                        <Tooltip content={<span className="whitespace-pre-line">{note}</span>}>
                          <p className="line-clamp-2 cursor-default text-[13px] text-muted-foreground">{note}</p>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {tab === "pending" && (
                        <span className="text-[13px] text-muted-foreground" title={fmt.date(e.appliedAt)}>
                          {fmt.relative(e.appliedAt)}
                        </span>
                      )}
                      {tab === "approved" && (
                        <div className="flex w-32 items-center gap-2">
                          <Progress value={e.progressPercent ?? 0} className="h-1.5" />
                          <span className="text-xs tabular-nums">{Math.round(e.progressPercent ?? 0)}%</span>
                        </div>
                      )}
                      {tab === "inactive" && <EnrollmentStatusBadge status={e.status} />}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{renderActions(e)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ReasonDialog
        action={reasonAction}
        onClose={() => setReasonAction(null)}
        onConfirm={confirmReason}
        pending={reject.isPending || revoke.isPending || bulk.isPending}
      />
      <AddLearnersDialog courseId={courseId} open={adding} onOpenChange={setAdding} seatsLeft={seatsLeft} />
    </div>
  );
}
