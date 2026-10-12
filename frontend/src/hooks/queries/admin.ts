"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import type { AdminUserDto, AdminUsersQuery, AdminUserUpdate, Page } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

export function useAdminStats() {
  return useQuery({ queryKey: qk.admin.stats, queryFn: adminApi.stats });
}

export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: qk.admin.users(query),
    queryFn: () => adminApi.users(query),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminUserUpdate }) => adminApi.updateUser(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ["admin", "users"] });
      const snapshot = qc.getQueriesData<Page<AdminUserDto>>({ queryKey: ["admin", "users"] });
      qc.setQueriesData<Page<AdminUserDto>>({ queryKey: ["admin", "users"] }, (p) =>
        p ? { ...p, content: p.content.map((u) => (u.id === id ? { ...u, ...body } : u)) } : p,
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
