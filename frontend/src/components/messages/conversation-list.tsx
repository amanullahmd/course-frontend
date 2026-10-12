"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConversationDto } from "@/lib/api/messages";
import { useConversations } from "@/hooks/queries/messages";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { shortStamp } from "./format";

function ConversationRow({ c, active }: { c: ConversationDto; active: boolean }) {
  const t = useTranslations("messaging");
  const fmt = useFormat();
  const unread = c.unreadCount > 0;
  return (
    <li>
      <Link
        href={`/messages/${c.id}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
          active && "bg-card shadow-xs ring-1 ring-border hover:bg-card",
        )}
      >
        <span className="relative mt-0.5">
          <UserAvatar name={c.other.fullName} src={c.other.avatarUrl} className="size-10" />
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-brand ring-2 ring-sidebar" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-sm", unread ? "font-semibold" : "font-medium")}>{c.other.fullName}</span>
            <span className={cn("shrink-0 text-[11px] tabular-nums", unread ? "font-medium text-brand-strong" : "text-muted-foreground")}>
              <time dateTime={c.lastMessageAt ?? undefined}>{shortStamp(c.lastMessageAt, fmt.dateLocale, t("yesterday"))}</time>
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "text-foreground" : "text-muted-foreground")}>
              {c.lastMessage?.mine && <span className="text-muted-foreground">{t("you")}: </span>}
              {c.lastMessage?.preview}
            </span>
            {unread && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums">
                <span className="sr-only">{t("unreadCount", { count: c.unreadCount })}</span>
                <span aria-hidden>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span>
              </span>
            )}
          </span>
          <span className="mt-1 flex">
            <span className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {c.course ? c.course.title : t("general")}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const t = useTranslations("messaging");
  const [q, setQ] = React.useState("");
  const debounced = useDebouncedValue(q.trim(), 300);
  const list = useConversations(debounced);
  const items = list.data?.content ?? [];

  return (
    <>
      <div className="grid gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <MessagesSquare className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.isPending ? (
          <div className="grid gap-1" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-3 py-2.5">
                <Skeleton className="size-10 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState className="m-2" error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-2xl border bg-card text-muted-foreground shadow-sm">
              <Inbox className="size-5" />
            </span>
            <p className="text-sm font-semibold">{debounced ? t("noResults") : t("emptyTitle")}</p>
            {!debounced && <p className="text-[13px] text-muted-foreground">{t("emptyText")}</p>}
          </div>
        ) : (
          <ul className="grid gap-0.5" aria-label={t("title")}>
            {items.map((c) => (
              <ConversationRow key={c.id} c={c} active={c.id === activeId} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
