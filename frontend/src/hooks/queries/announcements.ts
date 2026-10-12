"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  announcementKeys,
  announcementsApi,
  type AnnouncementDto,
  type AnnouncementUpsert,
  type CourseUnreadDto,
  type LearnerAnnouncementDto,
} from "@/lib/api/announcements";

// ---------------- instructor ----------------

export function useCourseAnnouncements(courseId: string) {
  return useQuery({ queryKey: announcementKeys.instructor(courseId), queryFn: () => announcementsApi.list(courseId) });
}

export function useAnnouncementMutations(courseId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: announcementKeys.instructor(courseId) });
  const upsertLocal = (a: AnnouncementDto) =>
    qc.setQueryData<AnnouncementDto[]>(announcementKeys.instructor(courseId), (list) =>
      list ? (list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]) : list,
    );
  // the composer shows field errors and its own toast
  const save = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: ({ id, body }: { id?: string; body: AnnouncementUpsert }) =>
      id ? announcementsApi.update(id, body) : announcementsApi.create(courseId, body),
    onSuccess: (a) => {
      upsertLocal(a);
      void invalidate();
    },
  });
  /** Saves (create or update) and sends right away. */
  const saveAndSend = useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: async ({ id, body }: { id?: string; body: AnnouncementUpsert }) => {
      const saved = id ? await announcementsApi.update(id, body) : await announcementsApi.create(courseId, body);
      upsertLocal(saved);
      return announcementsApi.send(saved.id);
    },
    onSuccess: (a) => upsertLocal(a),
    onSettled: () => invalidate(),
  });
  const send = useMutation({
    mutationFn: (id: string) => announcementsApi.send(id),
    onSuccess: (a) => upsertLocal(a),
    onSettled: () => invalidate(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => announcementsApi.remove(id),
    onSuccess: (_, id) =>
      qc.setQueryData<AnnouncementDto[]>(announcementKeys.instructor(courseId), (list) => list?.filter((a) => a.id !== id)),
    onSettled: () => invalidate(),
  });
  return { save, saveAndSend, send, remove };
}

// ---------------- learner ----------------

export function useLearnerAnnouncements(courseId: string, enabled = true) {
  return useQuery({
    queryKey: announcementKeys.learner(courseId),
    queryFn: () => announcementsApi.feed(courseId),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useUnreadAnnouncements(enabled = true) {
  return useQuery({
    queryKey: announcementKeys.unread,
    queryFn: announcementsApi.unread,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    select: (rows: CourseUnreadDto[]) => Object.fromEntries(rows.map((r) => [r.courseId, r.count])) as Record<string, number>,
  });
}

export function useMarkAnnouncementRead(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (id: string) => announcementsApi.markRead(id),
    onMutate: (id) => {
      qc.setQueryData<LearnerAnnouncementDto[]>(announcementKeys.learner(courseId), (list) =>
        list?.map((a) => (a.id === id ? { ...a, read: true } : a)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: announcementKeys.unread }),
  });
}
