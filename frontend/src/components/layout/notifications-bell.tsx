"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/hooks/queries/notifications";
import type { NotificationDto } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationItem({
  notification,
  onOpen,
  className,
}: {
  notification: NotificationDto;
  onOpen: (n: NotificationDto) => void;
  className?: string;
}) {
  const t = useTranslations("notifications");
  const fmt = useFormat();
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        "flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        className,
      )}
    >
      <span
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : "bg-brand")}
        aria-label={notification.read ? undefined : t("unread")}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", !notification.read && "font-medium")}>{notification.title}</span>
        {notification.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">{notification.body}</span>}
        <span className="mt-1 block text-xs text-muted-foreground">{fmt.relative(notification.createdAt)}</span>
      </span>
    </button>
  );
}

export function useOpenNotification() {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  return React.useCallback(
    (n: NotificationDto) => {
      if (!n.read) markRead.mutate(n.id);
      if (n.link) {
        if (/^https?:\/\//.test(n.link)) window.location.href = n.link;
        else router.push(n.link);
      }
    },
    [markRead, router],
  );
}

export function NotificationsBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = React.useState(false);
  const { data: unread = 0 } = useUnreadCount();
  const list = useNotifications(0, 8, open);
  const markAll = useMarkAllNotificationsRead();
  const openNotification = useOpenNotification();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={unread ? t("bellLabelUnread", { count: unread }) : t("bellLabel")}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground tabular-nums ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t("title")}</p>
          <Button variant="ghost" size="xs" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> {t("markAllRead")}
          </Button>
        </div>
        <div className="max-h-[22rem] overflow-y-auto p-1.5">
          {list.isPending ? (
            <div className="grid gap-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : list.data && list.data.content.length > 0 ? (
            list.data.content.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onOpen={(item) => {
                  setOpen(false);
                  openNotification(item);
                }}
              />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="size-6" />
              {t("allCaughtUp")}
            </div>
          )}
        </div>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              {t("viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
