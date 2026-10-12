"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, flashcardsApi, liveApi } from "@/lib/api/practice";
import type {
  AssignmentUpsert,
  AttendanceStatus,
  FlashcardGrade,
  FlashcardUpsert,
  LiveSeriesRequest,
  LiveSessionUpsert,
  SubmissionReviewRequest,
  SubmissionStatus,
  SubmitRequest,
} from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

/** Query keys of the practice features (flashcards, assignments, live sessions). */
export const pk = {
  deck: (itemId: string) => ["practice", "deck", itemId] as const,
  learnerDeck: (itemId: string) => ["practice", "learner-deck", itemId] as const,
  session: (courseId: string) => ["practice", "review-session", courseId] as const,
  summary: ["practice", "review-summary"] as const,
  assignment: (itemId: string) => ["practice", "assignment", itemId] as const,
  learnerAssignment: (itemId: string) => ["practice", "learner-assignment", itemId] as const,
  mySubmissions: (itemId: string) => ["practice", "my-submissions", itemId] as const,
  itemSubmissions: (itemId: string, status?: SubmissionStatus) => ["practice", "item-submissions", itemId, status ?? "ALL"] as const,
  courseSubmissions: (courseId: string, status?: SubmissionStatus) =>
    ["practice", "course-submissions", courseId, status ?? "ALL"] as const,
  submission: (id: string) => ["practice", "submission", id] as const,
  live: (courseId: string) => ["practice", "live", courseId] as const,
  attendance: (id: string) => ["practice", "attendance", id] as const,
  learnerLive: (courseId: string) => ["practice", "learner-live", courseId] as const,
  upcoming: ["practice", "upcoming"] as const,
  calendarToken: ["practice", "calendar-token"] as const,
};

// ------------------------------------------------------------------ flashcards (instructor)

export function useDeck(itemId: string) {
  return useQuery({ queryKey: pk.deck(itemId), queryFn: () => flashcardsApi.deck(itemId) });
}

export function useSaveDeck(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cards: FlashcardUpsert[]) => flashcardsApi.saveDeck(itemId, cards),
    onSuccess: (deck) => {
      qc.setQueryData(pk.deck(itemId), deck);
      void qc.invalidateQueries({ queryKey: pk.learnerDeck(itemId) });
    },
  });
}

export function useImportCsv(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, commit }: { file: File; commit: boolean }) => flashcardsApi.importCsv(itemId, file, commit),
    onSuccess: (result) => {
      if (result.committed) void qc.invalidateQueries({ queryKey: pk.deck(itemId) });
    },
  });
}

// ------------------------------------------------------------------ flashcards (learner)

export function useLearnerDeck(itemId: string) {
  return useQuery({ queryKey: pk.learnerDeck(itemId), queryFn: () => flashcardsApi.learnerDeck(itemId) });
}

/** The queue is fetched once per session; later changes are driven by the local queue. */
export function useReviewSession(courseId: string, limit = 20) {
  return useQuery({
    queryKey: [...pk.session(courseId), limit],
    queryFn: () => flashcardsApi.session(courseId, limit),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useGradeCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, grade }: { cardId: string; grade: FlashcardGrade }) => flashcardsApi.review(cardId, grade),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pk.summary });
      void qc.invalidateQueries({ queryKey: ["practice", "learner-deck"] });
    },
  });
}

export function useReviewSummary(enabled = true) {
  return useQuery({ queryKey: pk.summary, queryFn: flashcardsApi.summary, enabled, staleTime: 30_000 });
}

// ------------------------------------------------------------------ assignments (instructor)

export function useAssignmentSettings(itemId: string) {
  return useQuery({ queryKey: pk.assignment(itemId), queryFn: () => assignmentsApi.settings(itemId) });
}

export function useSaveAssignment(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignmentUpsert) => assignmentsApi.saveSettings(itemId, body),
    onSuccess: (data) => {
      qc.setQueryData(pk.assignment(itemId), data);
      void qc.invalidateQueries({ queryKey: pk.learnerAssignment(itemId) });
      void qc.invalidateQueries({ queryKey: ["instructor", "schedule"] });
    },
  });
}

export function useItemSubmissions(itemId: string, status?: SubmissionStatus) {
  return useQuery({
    queryKey: pk.itemSubmissions(itemId, status),
    queryFn: () => assignmentsApi.itemSubmissions(itemId, status),
    placeholderData: keepPreviousData,
  });
}

export function useCourseSubmissions(courseId: string, status?: SubmissionStatus) {
  return useQuery({
    queryKey: pk.courseSubmissions(courseId, status),
    queryFn: () => assignmentsApi.courseSubmissions(courseId, status),
    placeholderData: keepPreviousData,
  });
}

export function useSubmissionDetail(id: string | null) {
  return useQuery({
    queryKey: pk.submission(id ?? ""),
    queryFn: () => assignmentsApi.detail(id as string),
    enabled: !!id,
  });
}

export function useReviewSubmission(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmissionReviewRequest) => assignmentsApi.review(id, body),
    onSuccess: (detail) => {
      qc.setQueryData(pk.submission(id), detail);
      void qc.invalidateQueries({ queryKey: ["practice", "item-submissions"] });
      void qc.invalidateQueries({ queryKey: ["practice", "course-submissions"] });
    },
  });
}

// ------------------------------------------------------------------ assignments (learner)

export function useLearnerAssignment(itemId: string) {
  return useQuery({ queryKey: pk.learnerAssignment(itemId), queryFn: () => assignmentsApi.learnerView(itemId) });
}

export function useMySubmissions(itemId: string) {
  return useQuery({ queryKey: pk.mySubmissions(itemId), queryFn: () => assignmentsApi.mine(itemId) });
}

export function useSubmitAssignment(courseId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitRequest) => assignmentsApi.submit(itemId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pk.mySubmissions(itemId) });
      void qc.invalidateQueries({ queryKey: pk.learnerAssignment(itemId) });
      // submitting completes the item
      void qc.invalidateQueries({ queryKey: qk.student.item(itemId) });
      void qc.invalidateQueries({ queryKey: qk.student.learn(courseId) });
      void qc.invalidateQueries({ queryKey: qk.student.enrollments });
    },
  });
}

// ------------------------------------------------------------------ live sessions

export function useLiveSessions(courseId: string) {
  return useQuery({ queryKey: pk.live(courseId), queryFn: () => liveApi.list(courseId) });
}

function useLiveInvalidate(courseId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: pk.live(courseId) });
    void qc.invalidateQueries({ queryKey: pk.learnerLive(courseId) });
    void qc.invalidateQueries({ queryKey: pk.upcoming });
    void qc.invalidateQueries({ queryKey: ["instructor", "schedule"] });
  };
}

export function useCreateSession(courseId: string) {
  const invalidate = useLiveInvalidate(courseId);
  return useMutation({ mutationFn: (body: LiveSessionUpsert) => liveApi.create(courseId, body), onSuccess: invalidate });
}

export function useCreateSeries(courseId: string) {
  const invalidate = useLiveInvalidate(courseId);
  return useMutation({ mutationFn: (body: LiveSeriesRequest) => liveApi.series(courseId, body), onSuccess: invalidate });
}

export function useUpdateSession(courseId: string) {
  const invalidate = useLiveInvalidate(courseId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: LiveSessionUpsert }) => liveApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteSession(courseId: string) {
  const invalidate = useLiveInvalidate(courseId);
  return useMutation({ mutationFn: (id: string) => liveApi.remove(id), onSuccess: invalidate });
}

export function useAttendance(sessionId: string | null) {
  return useQuery({
    queryKey: pk.attendance(sessionId ?? ""),
    queryFn: () => liveApi.attendance(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useSaveAttendance(courseId: string, sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: { studentId: string; status: AttendanceStatus }[]) => liveApi.saveAttendance(sessionId, entries),
    onSuccess: (sheet) => {
      qc.setQueryData(pk.attendance(sessionId), sheet);
      void qc.invalidateQueries({ queryKey: pk.live(courseId) });
      void qc.invalidateQueries({ queryKey: pk.learnerLive(courseId) });
    },
  });
}

export function useLearnerSessions(courseId: string, enabled = true) {
  return useQuery({
    queryKey: pk.learnerLive(courseId),
    queryFn: () => liveApi.forCourse(courseId),
    enabled,
    // the join link appears 15 minutes before the start: re-check once a minute
    refetchInterval: 60_000,
  });
}

export function useUpcomingSessions(enabled = true) {
  return useQuery({ queryKey: pk.upcoming, queryFn: liveApi.upcoming, enabled, refetchInterval: 60_000 });
}

export function useCalendarToken(enabled = true) {
  return useQuery({ queryKey: pk.calendarToken, queryFn: liveApi.calendarToken, enabled });
}

export function useRotateCalendarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: liveApi.rotateCalendarToken,
    onSuccess: (data) => qc.setQueryData(pk.calendarToken, data),
  });
}
