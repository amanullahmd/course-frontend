"use client";

import * as React from "react";
import { Award, Copy, Download, Ellipsis, FileSpreadsheet, Plus, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { InstructorCertificateDto } from "@/lib/api/certificates";
import { useFormat } from "@/hooks/use-format";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useCourseEnrollments } from "@/hooks/queries/instructor";
import { useIssueCertificate, useIssuedCertificates, useRevokeCertificate } from "@/hooks/queries/certificates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCertificateDownload, useCopyLink } from "./certificate-actions";

function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function StatusBadge({ c }: { c: InstructorCertificateDto }) {
  const t = useTranslations("certificates.issued");
  return c.status === "ACTIVE" ? (
    <Badge variant="success">{t("statusActive")}</Badge>
  ) : (
    <Badge variant="destructive" title={c.revokedReason ?? undefined}>
      {t("statusRevoked")}
    </Badge>
  );
}

function IssueDialog({
  courseId,
  open,
  onOpenChange,
  holders,
}: {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holders: Set<string>;
}) {
  const t = useTranslations("certificates.issued");
  const errorMessage = useErrorMessage();
  const enrollments = useCourseEnrollments(courseId, "APPROVED");
  const issue = useIssueCertificate(courseId);
  const [studentId, setStudentId] = React.useState("");
  const candidates = (enrollments.data ?? []).filter((e) => !holders.has(e.student.id));
  const chosen = candidates.find((e) => e.student.id === studentId);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setStudentId("");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("issueTitle")}</DialogTitle>
          <DialogDescription>{t("issueText")}</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 && !enrollments.isPending ? (
          <p className="text-sm text-muted-foreground">{t("issueNoCandidates")}</p>
        ) : (
          <Field label={t("learner")} htmlFor="issue-student">
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger id="issue-student">
                <SelectValue placeholder={t("chooseLearner")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((e) => (
                  <SelectItem key={e.student.id} value={e.student.id}>
                    {e.student.fullName} · {e.progressPercent ?? 0}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {chosen && <p className="rounded-lg bg-warning-soft p-3 text-[13px] text-warning">{t("issueWarning", { name: chosen.student.fullName })}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!chosen || issue.isPending}
            onClick={() =>
              issue.mutate(studentId, {
                onSuccess: (c) => {
                  toast.success(t("issued", { name: c.learnerName }));
                  setStudentId("");
                  onOpenChange(false);
                },
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            <Award /> {t("issueConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({ courseId, target, onClose }: { courseId: string; target: InstructorCertificateDto | null; onClose: () => void }) {
  const t = useTranslations("certificates.issued");
  const errorMessage = useErrorMessage();
  const revoke = useRevokeCertificate(courseId);
  const [reason, setReason] = React.useState("");
  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("revokeTitle")}</DialogTitle>
          <DialogDescription>{target ? t("revokeText", { name: target.learnerName, code: target.code }) : null}</DialogDescription>
        </DialogHeader>
        <Field label={t("reason")} htmlFor="revoke-reason" hint={t("reasonHint")}>
          <Textarea id="revoke-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || revoke.isPending}
            onClick={() =>
              target &&
              revoke.mutate(
                { id: target.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(t("revoked"));
                    setReason("");
                    onClose();
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          >
            <ShieldX /> {t("revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Issued certificates of a course: search, CSV export, PDF download, manual issue and revocation. */
export function IssuedCertificates({ courseId, courseSlug }: { courseId: string; courseSlug: string }) {
  const t = useTranslations("certificates.issued");
  const fmt = useFormat();
  const list = useIssuedCertificates(courseId);
  const { download, pending } = useCertificateDownload("instructor");
  const copy = useCopyLink();
  const [q, setQ] = React.useState("");
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<InstructorCertificateDto | null>(null);

  const all = list.data ?? [];
  const query = q.trim().toLowerCase();
  const rows = query
    ? all.filter((c) => [c.learnerName, c.student.fullName, c.student.email, c.code].some((v) => v.toLowerCase().includes(query)))
    : all;
  const holders = new Set(all.filter((c) => c.status === "ACTIVE").map((c) => c.student.id));

  const exportCsv = () => {
    const header = [t("learner"), t("email"), t("code"), t("status"), t("type"), t("issuedAt"), t("score"), t("revokedAt"), t("reason"), t("verifyUrl")];
    const lines = rows.map((c) =>
      [
        c.learnerName,
        c.student.email,
        c.code,
        c.status === "ACTIVE" ? t("statusActive") : t("statusRevoked"),
        c.issueType === "MANUAL" ? t("typeManual") : t("typeAutomatic"),
        c.issuedAt.slice(0, 16).replace("T", " "),
        c.finalScore,
        c.revokedAt ? c.revokedAt.slice(0, 16).replace("T", " ") : "",
        c.revokedReason,
        c.verificationUrl,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificates-${courseSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section aria-labelledby="issued-certificates" className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="issued-certificates" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder={t("search")} aria-label={t("search")} className="w-full sm:w-64" />
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <FileSpreadsheet /> CSV
          </Button>
          <Button onClick={() => setIssueOpen(true)}>
            <Plus /> {t("issueManually")}
          </Button>
        </div>
      </div>

      {list.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={Award} title={t("emptyTitle")} description={t("emptyText")} compact />
      ) : rows.length === 0 ? (
        <EmptyState title={t("noMatches")} compact />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("learner")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("issuedAt")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("code")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={c.student.fullName} src={c.student.avatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.learnerName}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.student.email}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{fmt.date(c.issuedAt)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="whitespace-nowrap">{fmt.date(c.issuedAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.issueType === "MANUAL" ? t("typeManualBy", { name: c.issuedByName ?? "–" }) : t("typeAutomatic")}
                      {c.finalScore != null && ` · ${fmt.number(c.finalScore)}%`}
                    </p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs lg:table-cell">{c.code}</TableCell>
                  <TableCell>
                    <StatusBadge c={c} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={t("actionsFor", { name: c.learnerName })}>
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => download(c.id)} disabled={pending === c.id}>
                          <Download /> {t("downloadPdf")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copy(c.verificationUrl)}>
                          <Copy /> {t("copyLink")}
                        </DropdownMenuItem>
                        {c.status === "ACTIVE" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setRevoking(c)}>
                              <ShieldX /> {t("revoke")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <IssueDialog courseId={courseId} open={issueOpen} onOpenChange={setIssueOpen} holders={holders} />
      <RevokeDialog courseId={courseId} target={revoking} onClose={() => setRevoking(null)} />
    </section>
  );
}
