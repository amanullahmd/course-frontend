"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMessagesUnread } from "@/hooks/queries/messages";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Header icon linking to the inbox, with the number of unread direct messages (polled every 60 s). */
export function MessagesHeaderButton() {
  const t = useTranslations("messaging");
  const pathname = usePathname();
  const { data } = useMessagesUnread();
  const unread = data?.count ?? 0;
  const active = pathname === "/messages" || pathname.startsWith("/messages/");
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("relative", active && "bg-accent")}
      asChild
    >
      <Link href="/messages" aria-label={unread ? t("headerLabelUnread", { count: unread }) : t("headerLabel")} aria-current={active ? "page" : undefined}>
        <MessageSquare />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground tabular-nums ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
