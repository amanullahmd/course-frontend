"use client";

import * as React from "react";
import { BookCheck, GraduationCap, Library, Presentation, UserCheck, Users, UserX } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AdminUserDto, InstructorStatus, Role } from "@/lib/api/types";
import { InstructorDecisionButtons, InstructorStatusBadge, PendingInstructorsBanner } from "./instructor-review";
import { useFormat } from "@/hooks/use-format";
import { useAdminStats, useAdminUsers, useUpdateUser } from "@/hooks/queries/admin";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ROLES: Role[] = ["STUDENT", "INSTRUCTOR", "ADMIN"];
const SIZE = 20;

export function AdminView() {
  const { user: me } = useAuth();
  const t = useTranslations();
  const fmt = useFormat();
  const stats = useAdminStats();
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebouncedValue(q.trim(), 300);
  const [role, setRole] = React.useState<Role | "ALL">("ALL");
  const [status, setStatus] = React.useState<InstructorStatus | "ALL">("ALL");
  const [page, setPage] = React.useState(0);
  const users = useAdminUsers({
    q: debouncedQ || undefined,
    role: role === "ALL" ? undefined : role,
    instructorStatus: status === "ALL" ? undefined : status,
    page,
    size: SIZE,
  });
  const pendingCount = stats.data?.pendingInstructors ?? 0;
  const update = useUpdateUser();
  const s = stats.data;

  type Patch = Partial<{ role: Role; enabled: boolean }>;
  // Disabling an account and changing a role take effect immediately (open sessions end), so they are confirmed first.
  const [pendingChange, setPendingChange] = React.useState<{ user: AdminUserDto; patch: Patch } | null>(null);
  const request = (u: AdminUserDto, patch: Patch) => {
    if (patch.enabled === true) change(u, patch);
    else setPendingChange({ user: u, patch });
  };

  const change = (u: AdminUserDto, patch: Patch, onDone?: () => void) =>
    update.mutate(
      { id: u.id, body: { role: patch.role ?? u.role, enabled: patch.enabled ?? u.enabled } },
      {
        onSuccess: () =>
          toast.success(
            patch.role
              ? t("admin.roleChanged", { name: u.fullName, role: t(`roles.${patch.role}`) })
              : patch.enabled
                ? t("admin.enabled", { name: u.fullName })
                : t("admin.disabled", { name: u.fullName }),
          ),
        onSettled: () => onDone?.(),
      },
    );

  return (
    <PageContainer wide>
      <PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.intro")} />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("admin.users")} value={s?.users ?? 0} icon={Users} loading={stats.isPending} />
        <StatCard label={t("admin.students")} value={s?.students ?? 0} icon={GraduationCap} loading={stats.isPending} accent="info" />
        <StatCard label={t("admin.instructors")} value={s?.instructors ?? 0} icon={Presentation} loading={stats.isPending} accent="brand" />
        <StatCard label={t("admin.courses")} value={s?.courses ?? 0} icon={Library} loading={stats.isPending} />
        <StatCard label={t("admin.liveCourses")} value={s?.liveCourses ?? 0} icon={BookCheck} loading={stats.isPending} accent="success" />
        <StatCard label={t("admin.enrollments")} value={s?.enrollments ?? 0} icon={UserCheck} loading={stats.isPending} />
      </div>

      <PendingInstructorsBanner
        count={pendingCount}
        active={status === "PENDING"}
        onShow={() => {
          setStatus("PENDING");
          setRole("ALL");
          setPage(0);
        }}
      />

      <section className="mt-10" aria-labelledby="users-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="users-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {t("admin.users")}
            {pendingCount > 0 && (
              <Badge variant="warning" title={t("security.approval.pendingCount", { count: pendingCount })}>
                {t("security.approval.pendingCount", { count: pendingCount })}
              </Badge>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(0);
              }}
              placeholder={t("admin.search")}
              className="flex-1 sm:w-72"
            />
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as Role | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40" aria-label={t("admin.filterRole")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("admin.allRoles")}</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as InstructorStatus | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-48" aria-label={t("security.approval.filter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("security.approval.allStatuses")}</SelectItem>
                <SelectItem value="PENDING">
                  {t("security.approval.filterPending")}
                  {pendingCount > 0 ? ` (${pendingCount})` : ""}
                </SelectItem>
                <SelectItem value="REJECTED">{t("security.approval.filterRejected")}</SelectItem>
                <SelectItem value="APPROVED">{t("security.approval.filterApproved")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border bg-card">
          {users.isPending ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : users.isError ? (
            <ErrorState className="m-4" error={users.error} onRetry={() => users.refetch()} />
          ) : users.data.content.length === 0 ? (
            <EmptyState className="m-4 border-none" icon={UserX} title={t("admin.noUsers")} description={t("admin.noUsersText")} />
          ) : (
            <Table className={users.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.user")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("admin.joined")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("admin.verified")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("admin.role")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("admin.active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.content.map((u) => {
                  const self = u.id === me?.id;
                  const locked = self || !!u.deleted;
                  const roleSelect = (
                    <Select value={u.role} onValueChange={(r) => r !== u.role && request(u, { role: r as Role })} disabled={locked}>
                      <SelectTrigger size="sm" className="w-36" aria-label={t("admin.roleOf", { name: u.fullName })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                  const activeSwitch = (
                    <Switch
                      checked={u.enabled}
                      disabled={locked}
                      onCheckedChange={(c) => request(u, { enabled: c })}
                      aria-label={u.enabled ? t("admin.disable", { name: u.fullName }) : t("admin.enable", { name: u.fullName })}
                    />
                  );
                  return (
                    <TableRow key={u.id} className={!u.enabled ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.fullName} src={u.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.fullName} {self && <span className="text-xs font-normal text-muted-foreground">({t("common.you")})</span>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 empty:hidden">
                              <InstructorStatusBadge user={u} />
                              <InstructorDecisionButtons user={u} />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
                          {roleSelect}
                          {activeSwitch}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{fmt.date(u.createdAt)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.emailVerified ? <Badge variant="success">{t("admin.verified")}</Badge> : <Badge variant="warning">{t("admin.pending")}</Badge>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {roleSelect}
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {activeSwitch}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {users.data && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground tabular-nums">{t("admin.total", { count: users.data.totalElements })}</p>
            <Pagination page={page} totalPages={users.data.totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pendingChange !== null}
        onOpenChange={(open) => !open && !update.isPending && setPendingChange(null)}
        destructive={pendingChange?.patch.enabled === false}
        loading={update.isPending}
        title={
          pendingChange?.patch.enabled === false
            ? t("admin.confirmDisableTitle", { name: pendingChange.user.fullName })
            : t("admin.confirmRoleTitle", {
                name: pendingChange?.user.fullName ?? "",
                role: pendingChange?.patch.role ? t(`roles.${pendingChange.patch.role}`) : "",
              })
        }
        description={pendingChange?.patch.enabled === false ? t("admin.confirmDisableText") : t("admin.confirmRoleText")}
        confirmLabel={pendingChange?.patch.enabled === false ? t("admin.confirmDisable") : t("admin.confirmRole")}
        onConfirm={() => pendingChange && change(pendingChange.user, pendingChange.patch, () => setPendingChange(null))}
      />
    </PageContainer>
  );
}
