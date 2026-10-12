"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messageKeys, messagesApi, type MessageDto, type MessagePageDto } from "@/lib/api/messages";
import { qk } from "@/lib/query-keys";

/** Unread direct messages, polled every 60 s (header badge). */
export function useMessagesUnread(enabled = true) {
  return useQuery({
    queryKey: messageKeys.unread,
    queryFn: messagesApi.unread,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useConversations(q: string) {
  return useQuery({
    queryKey: messageKeys.conversations(q),
    queryFn: () => messagesApi.conversations(q),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: messageKeys.conversation(id ?? ""),
    queryFn: () => messagesApi.conversation(id!),
    enabled: !!id,
  });
}

/** A thread, newest page first; polled every 10 s while it is open. */
export function useThread(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: messageKeys.thread(id ?? ""),
    queryFn: ({ pageParam }) => messagesApi.messages(id!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: MessagePageDto) => (last.hasMore ? last.nextCursor : undefined),
    enabled: !!id,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** All loaded messages of a thread in chronological order (pages may overlap after new messages arrive). */
export function flattenThread(pages: MessagePageDto[] | undefined): MessageDto[] {
  if (!pages) return [];
  const byId = new Map<string, MessageDto>();
  for (const page of pages) for (const m of page.items) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
  );
}

function useInvalidateMessages() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: messageKeys.unread });
    void qc.invalidateQueries({ queryKey: messageKeys.conversationsAll });
  };
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMessages();
  return useMutation({
    meta: { suppressErrorToast: true }, // shown on the failed message bubble
    mutationFn: (body: string) => messagesApi.send(conversationId, body),
    onSuccess: (message) => {
      qc.setQueryData<{ pages: MessagePageDto[]; pageParams: (string | null)[] }>(messageKeys.thread(conversationId), (data) =>
        data && data.pages.length > 0
          ? { ...data, pages: [{ ...data.pages[0], items: [...data.pages[0].items, message] }, ...data.pages.slice(1)] }
          : data,
      );
      invalidate();
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMessages();
  return useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: () => messagesApi.markRead(conversationId),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
    },
  });
}

export function useStartConversation() {
  const invalidate = useInvalidateMessages();
  return useMutation({ meta: { suppressErrorToast: true }, mutationFn: messagesApi.start, onSuccess: () => invalidate() });
}
