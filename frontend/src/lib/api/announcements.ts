import { api } from "./client";
import type { Instant, Uuid } from "./types";

// ---------------------------------------------------------------------------
// Course announcements (instructor → learners)
// ---------------------------------------------------------------------------
export type AnnouncementAudience = "ALL_APPROVED" | "SELECTED";
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "SENT";

export interface AnnouncementAuthor {
  id: Uuid;
  fullName: string;
  avatarUrl: string | null;
}

export interface AnnouncementUpsert {
  title: string;
  /** Rich text (HTML); sanitized by the server. */
  body: string;
  audience: AnnouncementAudience;
  recipientIds: Uuid[];
  sendEmail: boolean;
  pinned: boolean;
  /** DRAFT (default) or SCHEDULED (then `scheduledAt` must be in the future). Ignored for sent announcements. */
  status: Exclude<AnnouncementStatus, "SENT">;
  scheduledAt: Instant | null;
}

export interface AnnouncementDto {
  id: Uuid;
  courseId: Uuid;
  courseTitle: string;
  author: AnnouncementAuthor;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  recipientIds: Uuid[];
  sendEmail: boolean;
  pinned: boolean;
  status: AnnouncementStatus;
  scheduledAt: Instant | null;
  sentAt: Instant | null;
  createdAt: Instant;
  updatedAt: Instant;
  /** Actual recipients once sent; for drafts/scheduled the learners it would reach right now. */
  recipientCount: number;
  readCount: number;
  readPercent: number;
}

export interface LearnerAnnouncementDto {
  id: Uuid;
  courseId: Uuid;
  author: AnnouncementAuthor;
  title: string;
  body: string;
  pinned: boolean;
  sentAt: Instant;
  updatedAt: Instant;
  edited: boolean;
  read: boolean;
}

export interface CourseUnreadDto {
  courseId: Uuid;
  count: number;
}

export const announcementKeys = {
  instructor: (courseId: string) => ["announcements", "instructor", courseId] as const,
  learner: (courseId: string) => ["announcements", "learner", courseId] as const,
  unread: ["announcements", "unread"] as const,
};

export const announcementsApi = {
  list: (courseId: Uuid) => api.get<AnnouncementDto[]>(`/api/instructor/courses/${courseId}/announcements`),
  create: (courseId: Uuid, body: AnnouncementUpsert) =>
    api.post<AnnouncementDto>(`/api/instructor/courses/${courseId}/announcements`, body),
  get: (id: Uuid) => api.get<AnnouncementDto>(`/api/instructor/announcements/${id}`),
  update: (id: Uuid, body: AnnouncementUpsert) => api.put<AnnouncementDto>(`/api/instructor/announcements/${id}`, body),
  remove: (id: Uuid) => api.delete(`/api/instructor/announcements/${id}`),
  send: (id: Uuid) => api.post<AnnouncementDto>(`/api/instructor/announcements/${id}/send`),
  // learner
  feed: (courseId: Uuid) => api.get<LearnerAnnouncementDto[]>(`/api/student/courses/${courseId}/announcements`),
  markRead: (id: Uuid) => api.post<void>(`/api/student/announcements/${id}/read`),
  unread: () => api.get<CourseUnreadDto[]>("/api/student/announcements/unread"),
};
