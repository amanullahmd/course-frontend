"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, Check, CheckCheck, RotateCw, SendHorizontal, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { MESSAGE_MAX_LENGTH, type ConversationDto, type MessageDto } from "@/lib/api/messages";
import { flattenThread, useConversation, useMarkConversationRead, useSendMessage, useThread } from "@/hooks/queries/messages";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkifiedText } from "./linkified-text";
import { dayKey, dayLabel, timeOf } from "./format";

interface PendingMessage {
  tempId: string;
  body: string;
  status: "sending" | "failed";
  error?: string;
}

/** Messages from the same sender within this many ms are visually grouped. */
const GROUP_GAP = 5 * 60_000;

function ThreadHeader({ conversation }: { conversation: ConversationDto | undefined }) {
  const t = useTranslations("messaging");
  const other = conversation?.other;
  const courseHref = conversation?.course
    ? other?.role === "INSTRUCTOR"
      ? `/learn/${conversation.course.id}`
      : `/instructor/courses/${conversation.course.id}?tab=students`
    : null;
  return (
    <div className="flex items-center gap-3 border-b bg-background/85 px-3 py-2.5 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon-sm" className="md:hidden" asChild>
        <Link href="/messages" aria-label={t("back")}>
          <ArrowLeft />
        </Link>
      </Button>
      {other ? (
        <>
          <UserAvatar name={other.fullName} src={other.avatarUrl} className="size-9" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] leading-tight font-semibold">{other.fullName}</h2>
            <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">{t(`roles.${other.role}`)}</span>
              <span aria-hidden>·</span>
              {conversation?.course && courseHref ? (
                <Link href={courseHref} className="truncate hover:text-foreground hover:underline" title={t("openCourse")}>
                  {conversation.course.title}
                </Link>
              ) : (
                <span className="truncate">{t("general")}</span>
              )}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="grid gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  mine,
  grouped,
  children,
  time,
  failed,
  sending,
}: {
  mine: boolean;
  grouped: boolean;
  children: React.ReactNode;
  time?: string;
  failed?: boolean;
  sending?: boolean;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 pt-2 pb-1.5 text-[14.5px] leading-relaxed shadow-xs sm:max-w-[70%]",
          mine
            ? cn("bg-brand text-brand-foreground", grouped ? "rounded-tr-md" : "rounded-br-md")
            : cn("bg-card ring-1 ring-border", grouped ? "rounded-tl-md" : "rounded-bl-md"),
          sending && "opacity-70",
          failed && "bg-destructive-soft text-foreground ring-1 ring-destructive/30",
        )}
      >
        {children}
        {time && (
          <div className={cn("mt-0.5 text-right text-[10.5px] tabular-nums", mine && !failed ? "text-brand-foreground/75" : "text-muted-foreground")}>
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  recipientName,
  onSend,
  disabled,
  autoFocus,
}: {
  recipientName: string;
  onSend: (body: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslations("messaging");
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const tooLong = text.length > MESSAGE_MAX_LENGTH;
  const canSend = !disabled && text.trim().length > 0 && !tooLong;
  const counterId = React.useId();

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  React.useEffect(() => {
    // Focus the composer when a thread opens, except on touch devices (it would pop up the keyboard).
    if (autoFocus && !window.matchMedia("(pointer: coarse)").matches) ref.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
    ref.current?.focus();
  };

  return (
    <div className="border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-card p-1.5 pl-3.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
          tooLong && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        )}
      >
        <textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("composerPlaceholder")}
          aria-label={t("composerLabel", { name: recipientName })}
          aria-describedby={counterId}
          aria-invalid={tooLong || undefined}
          className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[14.5px] leading-relaxed outline-none placeholder:text-muted-foreground/80"
        />
        <Button type="button" size="icon" className="size-9 shrink-0 rounded-xl" onClick={submit} disabled={!canSend} aria-label={t("send")}>
          <SendHorizontal />
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
        <span className="hidden sm:inline">{t("composerHint")}</span>
        <span id={counterId} className={cn("ml-auto tabular-nums", tooLong ? "font-medium text-destructive" : text.length < 4000 && "sr-only")}>
          {tooLong ? t("tooLong", { max: MESSAGE_MAX_LENGTH }) : t("counter", { count: text.length, max: MESSAGE_MAX_LENGTH })}
        </span>
      </div>
    </div>
  );
}

export function MessageThread({ conversationId }: { conversationId: string }) {
  const t = useTranslations("messaging");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const conversation = useConversation(conversationId);
  const thread = useThread(conversationId);
  const send = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const messages = React.useMemo(() => flattenThread(thread.data?.pages), [thread.data]);
  const [pending, setPending] = React.useState<PendingMessage[]>([]);
  const [showNewPill, setShowNewPill] = React.useState(false);
  const [liveText, setLiveText] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);
  const lastSeenId = React.useRef<string | null>(null);
  const heightBeforeOlder = React.useRef<number | null>(null);
  const markedFor = React.useRef<string | null>(null);
  const otherName = conversation.data?.other.fullName ?? "";

  const scrollToBottom = React.useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Keep the view pinned to the newest message, announce incoming ones, keep the position when older ones load.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (heightBeforeOlder.current != null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
      return;
    }
    const last = messages.at(-1);
    const lastId = last?.id ?? null;
    if (lastId === lastSeenId.current) return;
    const initial = lastSeenId.current === null;
    lastSeenId.current = lastId;
    if (initial || atBottom.current || last?.mine) {
      el.scrollTop = el.scrollHeight;
    } else {
      setShowNewPill(true);
    }
    if (!initial && last && !last.mine) {
      setLiveText(`${t("newMessageFrom", { name: otherName })}: ${last.body.slice(0, 200)}`);
    }
  }, [messages, otherName, t]);

  React.useLayoutEffect(() => {
    if (pending.length > 0) scrollToBottom();
  }, [pending.length, scrollToBottom]);

  // Mark incoming messages as read while the thread is visible.
  React.useEffect(() => {
    const latestIncoming = [...messages].reverse().find((m) => !m.mine);
    if (!latestIncoming || latestIncoming.read) return;
    const mark = () => {
      if (document.visibilityState !== "visible" || markedFor.current === latestIncoming.id) return;
      markedFor.current = latestIncoming.id;
      markRead.mutate();
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [messages, markRead]);

  const deliver = (body: string, tempId: string) => {
    send
      .mutateAsync(body)
      .then(() => setPending((p) => p.filter((x) => x.tempId !== tempId)))
      .catch((e: unknown) => {
        const error =
          isApiError(e) && e.status === 429
            ? t("rateLimited")
            : isApiError(e) && e.status === 403
              ? t("notAllowed")
              : errorMessage(e);
        setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: "failed", error } : x)));
      });
  };

  const onSend = (body: string) => {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    atBottom.current = true;
    setPending((p) => [...p, { tempId, body, status: "sending" }]);
    deliver(body, tempId);
  };

  const retry = (item: PendingMessage) => {
    setPending((p) => p.map((x) => (x.tempId === item.tempId ? { ...x, status: "sending", error: undefined } : x)));
    deliver(item.body, item.tempId);
  };

  const loadOlder = () => {
    if (scrollRef.current) heightBeforeOlder.current = scrollRef.current.scrollHeight;
    void thread.fetchNextPage();
  };

  const notFound =
    (isApiError(conversation.error) && conversation.error.status === 404) ||
    (isApiError(thread.error) && thread.error.status === 404);
  if (notFound) {
    return (
      <div className="flex flex-1 flex-col">
        <ThreadHeader conversation={undefined} />
        <div className="mx-auto w-full max-w-md px-4 py-16">
          <EmptyState
            title={t("threadNotFound")}
            action={
              <Button variant="outline" asChild>
                <Link href="/messages">{t("back")}</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const lastMine = [...messages].reverse().find((m) => m.mine);
  const lastMessage = messages.at(-1);

  const rows: React.ReactNode[] = [];
  let prev: MessageDto | null = null;
  for (const m of messages) {
    const day = dayKey(m.createdAt);
    const newDay = !prev || dayKey(prev.createdAt) !== day;
    if (newDay) {
      rows.push(
        <li key={`day-${day}`} className="sticky top-2 z-10 my-4 flex justify-center first:mt-1" role="presentation">
          <span className="rounded-full border bg-background/90 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur">
            {dayLabel(m.createdAt, fmt.dateLocale, t("today"), t("yesterday"))}
          </span>
        </li>,
      );
    }
    const grouped =
      !newDay && !!prev && prev.mine === m.mine && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_GAP;
    rows.push(
      <li key={m.id}>
        <Bubble mine={m.mine} grouped={grouped} time={timeOf(m.createdAt, fmt.dateLocale)}>
          <span className="sr-only">{m.mine ? t("you") : otherName}: </span>
          <LinkifiedText text={m.body} linkClassName={m.mine ? "text-brand-foreground" : "text-brand-strong"} />
        </Bubble>
        {m.id === lastMine?.id && m.id === lastMessage?.id && pending.length === 0 && (
          <p className="mt-1 flex items-center justify-end gap-1 pr-1 text-[11px] text-muted-foreground">
            {m.read ? <CheckCheck className="size-3.5 text-brand-strong" /> : <Check className="size-3.5" />}
            {m.read ? t("seen") : t("sent")}
          </p>
        )}
      </li>,
    );
    prev = m;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ThreadHeader conversation={conversation.data} />
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (atBottom.current && showNewPill) setShowNewPill(false);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30 px-3 py-4 sm:px-6"
        role="log"
        aria-label={t("threadLabel", { name: otherName })}
      >
        <div className="mx-auto w-full max-w-3xl">
          {thread.isPending ? (
            <div className="grid gap-3" aria-busy>
              {[60, 40, 70, 35, 55].map((w, i) => (
                <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
                  <Skeleton className="h-12 rounded-2xl" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : thread.isError ? (
            <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
          ) : (
            <>
              {thread.hasNextPage && (
                <div className="mb-2 flex justify-center">
                  <Button variant="outline" size="xs" onClick={loadOlder} loading={thread.isFetchingNextPage}>
                    {thread.isFetchingNextPage ? t("loadingOlder") : t("loadOlder")}
                  </Button>
                </div>
              )}
              {messages.length === 0 && pending.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">{t("threadEmpty")}</p>
              ) : (
                <ol className="pb-1">
                  {rows}
                  {pending.map((p) => (
                    <li key={p.tempId}>
                      <Bubble mine grouped={false} sending={p.status === "sending"} failed={p.status === "failed"}>
                        <LinkifiedText text={p.body} />
                      </Bubble>
                      <div className="mt-1 flex items-center justify-end gap-2 pr-1 text-[11px]" aria-live="polite">
                        {p.status === "sending" ? (
                          <span className="text-muted-foreground">{t("sending")}</span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-destructive">
                              <TriangleAlert className="size-3.5" /> {p.error ?? t("failed")}
                            </span>
                            <Button variant="ghost" size="xs" onClick={() => retry(p)}>
                              <RotateCw /> {t("retry")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label={t("discardFailed")}
                              onClick={() => setPending((list) => list.filter((x) => x.tempId !== p.tempId))}
                            >
                              <X />
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
      {showNewPill && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center">
          <Button
            size="xs"
            className="pointer-events-auto rounded-full shadow-md"
            onClick={() => {
              setShowNewPill(false);
              scrollToBottom(true);
            }}
          >
            <ArrowDown /> {t("newMessages")}
          </Button>
        </div>
      )}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveText}
      </div>
      <Composer recipientName={otherName} onSend={onSend} disabled={!conversation.data} autoFocus />
    </div>
  );
}
