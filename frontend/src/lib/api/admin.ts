import { api } from "./client";
import type { AdminStatsDto, AdminUserDto, AdminUsersQuery, AdminUserUpdate, Page, UserDto } from "./types";

export const adminApi = {
  stats: () => api.get<AdminStatsDto>("/api/admin/stats"),
  users: (query: AdminUsersQuery) => api.get<Page<AdminUserDto>>("/api/admin/users", { ...query }),
  updateUser: (id: string, body: AdminUserUpdate) => api.put<UserDto & { enabled?: boolean }>(`/api/admin/users/${id}`, body),
};
