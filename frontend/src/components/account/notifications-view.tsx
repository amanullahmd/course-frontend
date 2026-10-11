"use client";

import * as React from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMarkAllNotificationsRead, useNotifications, useUnreadCount } from "@/hooks/queries/notifications";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { NotificationItem, useOpenNotification } from "@/components/layout/notifications-bell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

const SIZE = 20;

export function NotificationsView() {
  const t = useTranslations("notifications");
  const [page, setPage] = React.useState(0);
  const list = useNotifications(page, SIZE);
  const { data: unread = 0 } = useUnreadCount();
  const markAll = useMarkAllNotificationsRead();
  const open = useOpenNotification();

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title={t("title")}
        description={unread > 0 ? t("unreadCount", { count: unread }) : t("allCaughtUp")}
        actions={
          <Button variant="outline" size="sm" disabled={unread === 0} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> {t("markAllAsRead")}
          </Button>
        }
      />
      <div className="mt-8">
        {list.isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.content.length === 0 ? (
          <EmptyState icon={BellOff} title={t("emptyTitle")} description={t("emptyText")} />
        ) : (
          <div className="grid gap-6">
            <div className="divide-y rounded-xl border bg-card p-1.5">
              {list.data.content.map((n) => (
                <NotificationItem key={n.id} notification={n} onOpen={open} className="rounded-lg" />
              ))}
            </div>
            <Pagination page={page} totalPages={list.data.totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
