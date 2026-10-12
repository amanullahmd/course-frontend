"use client";

import { useParams } from "next/navigation";
import { MessageThread } from "./message-thread";

/** `/messages/[conversationId]`: the thread, remounted per conversation so its local state starts fresh. */
export function ConversationView() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return <MessageThread key={conversationId} conversationId={conversationId} />;
}
