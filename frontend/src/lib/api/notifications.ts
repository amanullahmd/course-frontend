import { api } from "./client";
import type { NotificationDto, Page, UnreadCountDto } from "./types";

export const notificationsApi = {
  list: (page = 0, size = 20) => api.get<Page<NotificationDto>>("/api/notifications", { page, size }),
  unreadCount: () => api.get<UnreadCountDto>("/api/notifications/unread-count"),
  markRead: (id: string) => api.post<void>(`/api/notifications/${id}/read`),
  markAllRead: () => api.post<void>("/api/notifications/read-all"),
};
