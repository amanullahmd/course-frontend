"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import type { NotificationDto, Page } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: notificationsApi.unreadCount,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    select: (d) => d.count,
  });
}

export function useNotifications(page: number, size: number, enabled = true) {
  return useQuery({
    queryKey: qk.notifications.list(page, size),
    queryFn: () => notificationsApi.list(page, size),
    enabled,
    placeholderData: (prev) => prev,
  });
}

function markLocal(page: Page<NotificationDto> | undefined, id: string | null): Page<NotificationDto> | undefined {
  if (!page) return page;
  return { ...page, content: page.content.map((n) => (id === null || n.id === id ? { ...n, read: true } : n)) };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk.notifications.all });
      qc.setQueriesData<Page<NotificationDto>>({ queryKey: ["notifications", "list"] }, (p) => markLocal(p, id));
      qc.setQueryData<{ count: number }>(qk.notifications.unread, (c) => (c ? { count: Math.max(0, c.count - 1) } : c));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.notifications.all });
      qc.setQueriesData<Page<NotificationDto>>({ queryKey: ["notifications", "list"] }, (p) => markLocal(p, null));
      qc.setQueryData(qk.notifications.unread, { count: 0 });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}
