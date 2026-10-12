"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";

/**
 * Two-pane inbox: conversation list | thread on desktop. On small screens `/messages` shows the list and
 * `/messages/[conversationId]` only the thread. The list stays mounted while switching conversations.
 */
export function MessagesShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ conversationId?: string }>();
  const activeId = params.conversationId;
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[24rem] w-full">
      <aside
        className={cn(
          "flex min-h-0 w-full flex-col border-r bg-sidebar md:w-80 md:shrink-0 lg:w-[22rem]",
          activeId && "hidden md:flex",
        )}
      >
        <ConversationList activeId={activeId} />
      </aside>
      <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !activeId && "hidden md:flex")}>{children}</section>
    </div>
  );
}

export function NoConversationSelected() {
  const t = useTranslations("messaging");
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border bg-card text-muted-foreground shadow-sm">
          <MessagesSquare className="size-5" />
        </span>
        <h2 className="text-base font-semibold">{t("selectTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("selectText")}</p>
      </div>
    </div>
  );
}
