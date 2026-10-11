"use client";

import * as React from "react";
import { BookCheck, GraduationCap, Library, Presentation, UserCheck, Users, UserX } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AdminUserDto, Role } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { useAdminStats, useAdminUsers, useUpdateUser } from "@/hooks/queries/admin";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  const [page, setPage] = React.useState(0);
  const users = useAdminUsers({ q: debouncedQ || undefined, role: role === "ALL" ? undefined : role, page, size: SIZE });
  const update = useUpdateUser();
  const s = stats.data;

  const change = (u: AdminUserDto, patch: Partial<{ role: Role; enabled: boolean }>) =>
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
      },
    );

  return (
    <PageContainer wide>
      <PageHeader eyebrow={t("admin.eyebrow")} title={t("admin.title")} description={t("admin.intro")} />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t("admin.users")} value={s?.users ?? 0} icon={Users} loading={stats.isPending} />
        <StatCard label={t("admin.students")} value={s?.students ?? 0} icon={GraduationCap} loading={stats.isPending} accent="info" />
        <StatCard label={t("admin.instructors")} value={s?.instructors ?? 0} icon={Presentation} loading={stats.isPending} accent="brand" />
        <StatCard label={t("admin.courses")} value={s?.courses ?? 0} icon={Library} loading={stats.isPending} />
        <StatCard label={t("admin.liveCourses")} value={s?.liveCourses ?? 0} icon={BookCheck} loading={stats.isPending} accent="success" />
        <StatCard label={t("admin.enrollments")} value={s?.enrollments ?? 0} icon={UserCheck} loading={stats.isPending} />
      </div>

      <section className="mt-10" aria-labelledby="users-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="users-heading" className="text-lg font-semibold tracking-tight">
            {t("admin.users")}
          </h2>
          <div className="flex gap-2">
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
                  <TableHead>{t("admin.role")}</TableHead>
                  <TableHead className="text-right">{t("admin.active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.content.map((u) => {
                  const self = u.id === me?.id;
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
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{fmt.date(u.createdAt)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.emailVerified ? <Badge variant="success">{t("admin.verified")}</Badge> : <Badge variant="warning">{t("admin.pending")}</Badge>}
                      </TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(r) => change(u, { role: r as Role })} disabled={self}>
                          <SelectTrigger size="sm" className="w-32" aria-label={t("admin.roleOf", { name: u.fullName })}>
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
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={u.enabled}
                          disabled={self}
                          onCheckedChange={(c) => change(u, { enabled: c })}
                          aria-label={u.enabled ? t("admin.disable", { name: u.fullName }) : t("admin.enable", { name: u.fullName })}
                        />
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
    </PageContainer>
  );
}
