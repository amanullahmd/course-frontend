"use client";

import * as React from "react";
import { BookCheck, GraduationCap, Library, Presentation, UserCheck, Users, UserX } from "lucide-react";
import { toast } from "sonner";
import type { AdminUserDto, Role } from "@/lib/api/types";
import { ROLE_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
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
            patch.role ? `${u.fullName} is now ${ROLE_META[patch.role].label.toLowerCase()}` : `${u.fullName} ${patch.enabled ? "enabled" : "disabled"}`,
          ),
      },
    );

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Admin console" title="Platform overview" description="Manage users and keep an eye on platform health." />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Users" value={s?.users ?? 0} icon={Users} loading={stats.isPending} />
        <StatCard label="Students" value={s?.students ?? 0} icon={GraduationCap} loading={stats.isPending} accent="info" />
        <StatCard label="Instructors" value={s?.instructors ?? 0} icon={Presentation} loading={stats.isPending} accent="brand" />
        <StatCard label="Courses" value={s?.courses ?? 0} icon={Library} loading={stats.isPending} />
        <StatCard label="Live courses" value={s?.liveCourses ?? 0} icon={BookCheck} loading={stats.isPending} accent="success" />
        <StatCard label="Enrollments" value={s?.enrollments ?? 0} icon={UserCheck} loading={stats.isPending} />
      </div>

      <section className="mt-10" aria-labelledby="users-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="users-heading" className="text-lg font-semibold tracking-tight">
            Users
          </h2>
          <div className="flex gap-2">
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(0);
              }}
              placeholder="Search name or e-mail…"
              className="flex-1 sm:w-72"
            />
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as Role | "ALL");
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_META[r].label}
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
            <EmptyState className="m-4 border-none" icon={UserX} title="No users found" description="Try another search or role filter." />
          ) : (
            <Table className={users.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="hidden sm:table-cell">Verified</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Active</TableHead>
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
                              {u.fullName} {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.emailVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Pending</Badge>}
                      </TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(r) => change(u, { role: r as Role })} disabled={self}>
                          <SelectTrigger size="sm" className="w-32" aria-label={`Role of ${u.fullName}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_META[r].label}
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
                          aria-label={`${u.enabled ? "Disable" : "Enable"} ${u.fullName}`}
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
            <p className="text-sm text-muted-foreground tabular-nums">{users.data.totalElements} users</p>
            <Pagination page={page} totalPages={users.data.totalPages} onPageChange={setPage} />
          </div>
        )}
      </section>
    </PageContainer>
  );
}
