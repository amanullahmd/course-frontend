"use client";

import * as React from "react";
import { Check, Hourglass, ShieldX, UserCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { EnrollmentDto, EnrollmentStatus } from "@/lib/api/types";
import { formatDate, formatRelative } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
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

type Tab = "pending" | "approved" | "inactive";
const TAB_STATUSES: Record<Tab, EnrollmentStatus[]> = {
  pending: ["PENDING"],
  approved: ["APPROVED"],
  inactive: ["REJECTED", "REVOKED", "WITHDRAWN"],
};

type ReasonAction = { kind: "reject" | "revoke" | "bulk-reject"; ids: string[]; names: string };

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
  const [reason, setReason] = React.useState("");
  const revoke = action?.kind === "revoke";
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
          <DialogTitle>{revoke ? "Revoke access" : "Reject application"}{action && action.ids.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            {action?.names}. {revoke ? "The learner immediately loses access to the course." : "The learner is notified in-app and by e-mail."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="decision-reason">
            Reason <span className="font-normal text-muted-foreground">(shared with the learner, optional)</span>
          </Label>
          <Textarea
            id="decision-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder={revoke ? "e.g. Course period has ended." : "e.g. This course is full. Please consider the B1 course instead."}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() => {
              onConfirm(reason.trim() || null);
              setReason("");
            }}
          >
            {revoke ? "Revoke access" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudentsPanel({ courseId, capacity }: { courseId: string; capacity: number | null }) {
  const enrollments = useCourseEnrollments(courseId);
  const { approve, reject, revoke, bulk } = useEnrollmentActions(courseId);
  const [tab, setTab] = React.useState<Tab>("pending");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reasonAction, setReasonAction] = React.useState<ReasonAction | null>(null);

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
  const selectable = tab === "pending";
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allChecked = selectable && rows.length > 0 && selectedRows.length === rows.length;
  const seatsLeft = capacity != null ? capacity - counts.approved : null;

  const clearSelection = () => setSelected(new Set());

  const approveOne = (e: EnrollmentDto) =>
    approve.mutate(e.id, { onSuccess: () => toast.success(`${e.student.fullName} approved`) });

  const confirmReason = (reason: string | null) => {
    if (!reasonAction) return;
    const done = () => {
      setReasonAction(null);
      clearSelection();
    };
    if (reasonAction.kind === "reject")
      reject.mutate({ id: reasonAction.ids[0], reason }, {
          onSuccess: () => {
            toast.success("Application rejected");
            done();
          },
        });
    else if (reasonAction.kind === "revoke")
      revoke.mutate({ id: reasonAction.ids[0], reason }, {
          onSuccess: () => {
            toast.success("Access revoked");
            done();
          },
        });
    else
      bulk.mutate(
        { ids: reasonAction.ids, action: "REJECT", reason },
        {
          onSuccess: (r) => {
            toast.success(`${pluralize(r.length, "application")} rejected`);
            done();
          },
        },
      );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Tab);
            clearSelection();
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">
              <Hourglass /> Waitlist {counts.pending > 0 && <Badge variant="info" className="ml-0.5 px-1.5">{counts.pending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approved">
              <UserCheck /> Approved <span className="text-muted-foreground tabular-nums">{counts.approved}</span>
            </TabsTrigger>
            <TabsTrigger value="inactive">
              <ShieldX /> Rejected & revoked
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder="Search learners…" className="sm:w-64" />
      </div>

      {seatsLeft != null && (
        <p className="text-sm text-muted-foreground">
          Capacity: <span className="font-medium text-foreground tabular-nums">{counts.approved}</span> / {capacity} seats taken
          {seatsLeft <= 0 && <span className="text-warning"> · course is full, approvals beyond capacity will be refused</span>}
        </p>
      )}

      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft/40 px-4 py-2.5 animate-slide-up">
          <span className="text-sm font-medium">{selectedRows.length} selected</span>
          <Button
            size="sm"
            loading={bulk.isPending && !reasonAction}
            onClick={() =>
              bulk.mutate(
                { ids: selectedRows.map((r) => r.id), action: "APPROVE" },
                {
                  onSuccess: (r) => {
                    toast.success(`${pluralize(r.length, "learner")} approved`);
                    clearSelection();
                  },
                },
              )
            }
          >
            <Check /> Approve selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setReasonAction({ kind: "bulk-reject", ids: selectedRows.map((r) => r.id), names: pluralize(selectedRows.length, "application") })
            }
          >
            <X /> Reject selected
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            Clear
          </Button>
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
            title={q ? "No learners match your search" : tab === "pending" ? "No pending applications" : tab === "approved" ? "No approved learners yet" : "Nothing here"}
            description={tab === "pending" && !q ? "New applications appear here, ordered by when they were submitted." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked ? true : selectedRows.length > 0 ? "indeterminate" : false}
                      onCheckedChange={(c) => setSelected(c === true ? new Set(rows.map((r) => r.id)) : new Set())}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {tab === "pending" && <TableHead className="w-12">#</TableHead>}
                <TableHead>Learner</TableHead>
                <TableHead className="hidden md:table-cell">{tab === "inactive" ? "Reason" : "Message"}</TableHead>
                <TableHead className="hidden sm:table-cell">{tab === "pending" ? "Applied" : tab === "approved" ? "Progress" : "Status"}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                  {selectable && (
                    <TableCell>
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
                        aria-label={`Select ${e.student.fullName}`}
                      />
                    </TableCell>
                  )}
                  {tab === "pending" && <TableCell className="font-medium text-muted-foreground tabular-nums">{e.waitlistPosition ?? "–"}</TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={e.student.fullName} src={e.student.avatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.student.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.student.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-xs md:table-cell">
                    {(() => {
                      const text = tab === "inactive" ? e.decisionReason : e.message;
                      if (!text) return <span className="text-muted-foreground">–</span>;
                      return (
                        <Tooltip content={<span className="whitespace-pre-line">{text}</span>}>
                          <p className="line-clamp-2 cursor-default text-[13px] text-muted-foreground">{text}</p>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {tab === "pending" && (
                      <span className="text-[13px] text-muted-foreground" title={formatDate(e.appliedAt)}>
                        {formatRelative(e.appliedAt)}
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {e.status === "PENDING" && (
                        <>
                          <Button size="xs" onClick={() => approveOne(e)} disabled={approve.isPending}>
                            <Check /> Approve
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => setReasonAction({ kind: "reject", ids: [e.id], names: e.student.fullName })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {e.status === "APPROVED" && (
                        <Button size="xs" variant="destructive-ghost" onClick={() => setReasonAction({ kind: "revoke", ids: [e.id], names: e.student.fullName })}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
    </div>
  );
}
