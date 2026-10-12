import { api } from "./client";
import type { Instant, Page, Role, Uuid } from "./types";

// ---------------------------------------------------------------------------
// Direct messages (instructor ↔ learner)
// ---------------------------------------------------------------------------
export const MESSAGE_MAX_LENGTH = 5000;

export interface ParticipantDto {
  id: Uuid;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
}

export interface ConversationDto {
  id: Uuid;
  course: { id: Uuid; title: string } | null;
  other: ParticipantDto;
  lastMessage: { preview: string; senderId: Uuid; mine: boolean; createdAt: Instant } | null;
  lastMessageAt: Instant | null;
  unreadCount: number;
  createdAt: Instant;
}

export interface MessageDto {
  id: Uuid;
  conversationId: Uuid;
  senderId: Uuid;
  mine: boolean;
  /** Plain text. */
  body: string;
  createdAt: Instant;
  /** Mine: read by the other participant. Theirs: read by me. */
  read: boolean;
}

/** Chronological page; the first one holds the newest messages, `nextCursor` loads older ones. */
export interface MessagePageDto {
  items: MessageDto[];
  hasMore: boolean;
  nextCursor: Uuid | null;
}

export interface MessagesUnreadDto {
  count: number;
  conversations: number;
}

export interface StartConversationRequest {
  recipientId: Uuid;
  courseId?: Uuid | null;
  body: string;
}

export const messageKeys = {
  all: ["messages"] as const,
  conversations: (q: string) => ["messages", "conversations", q] as const,
  conversationsAll: ["messages", "conversations"] as const,
  conversation: (id: string) => ["messages", "conversation", id] as const,
  thread: (id: string) => ["messages", "thread", id] as const,
  unread: ["messages", "unread"] as const,
};

export const messagesApi = {
  conversations: (q = "", page = 0, size = 50) =>
    api.get<Page<ConversationDto>>("/api/messages/conversations", { q: q || undefined, page, size }),
  conversation: (id: Uuid) => api.get<ConversationDto>(`/api/messages/conversations/${id}`),
  /** The existing conversation with a user in a course (or the general one); rejects with 404 if none. */
  findWith: (userId: Uuid, courseId?: Uuid | null) =>
    api.get<ConversationDto>(`/api/messages/conversations/with/${userId}`, { courseId: courseId ?? undefined }),
  start: (body: StartConversationRequest) => api.post<ConversationDto>("/api/messages/conversations", body),
  messages: (id: Uuid, before?: Uuid | null, size = 30) =>
    api.get<MessagePageDto>(`/api/messages/conversations/${id}/messages`, { before: before ?? undefined, size }),
  send: (id: Uuid, body: string) => api.post<MessageDto>(`/api/messages/conversations/${id}/messages`, { body }),
  markRead: (id: Uuid) => api.post<void>(`/api/messages/conversations/${id}/read`),
  unread: () => api.get<MessagesUnreadDto>("/api/messages/unread-count"),
};
