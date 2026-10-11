"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import type { LearnCourseDto, LearnItemDto, SubmitAttemptRequest } from "@/lib/api/types";
import { qk } from "@/lib/query-keys";

export function useMyEnrollments(enabled = true) {
  return useQuery({ queryKey: qk.student.enrollments, queryFn: studentApi.enrollments, enabled });
}

/** The current user's enrollment for a course, or null when none exists (404). */
export function useMyEnrollment(courseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.student.enrollment(courseId ?? ""),
    enabled: enabled && !!courseId,
    queryFn: async () => {
      try {
        return await studentApi.enrollment(courseId as string);
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export function useApply(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string | null) => studentApi.apply(courseId, message),
    onSuccess: (enrollment) => {
      qc.setQueryData(qk.student.enrollment(courseId), enrollment);
      void qc.invalidateQueries({ queryKey: qk.student.enrollments });
    },
  });
}

export function useWithdraw(courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enrollmentId: string) => studentApi.withdraw(enrollmentId),
    onSuccess: (enrollment) => {
      if (courseId) qc.setQueryData(qk.student.enrollment(courseId), enrollment);
      void qc.invalidateQueries({ queryKey: qk.student.all });
    },
  });
}

export function useLearnCourse(courseId: string) {
  return useQuery({ queryKey: qk.student.learn(courseId), queryFn: () => studentApi.learnCourse(courseId) });
}

export function useLearnItem(itemId: string) {
  return useQuery({ queryKey: qk.student.item(itemId), queryFn: () => studentApi.item(itemId) });
}

export function useToggleComplete(courseId: string, itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (completed: boolean) => (completed ? studentApi.complete(itemId) : studentApi.uncomplete(itemId)),
    onMutate: async (completed) => {
      await qc.cancelQueries({ queryKey: qk.student.learn(courseId) });
      const prevCourse = qc.getQueryData<LearnCourseDto>(qk.student.learn(courseId));
      const prevItem = qc.getQueryData<LearnItemDto>(qk.student.item(itemId));
      if (prevCourse) {
        const modules = prevCourse.modules.map((m) => ({
          ...m,
          items: m.items.map((i) => (i.id === itemId ? { ...i, completed } : i)),
        }));
        const all = modules.flatMap((m) => m.items);
        const done = all.filter((i) => i.completed).length;
        qc.setQueryData<LearnCourseDto>(qk.student.learn(courseId), {
          ...prevCourse,
          modules,
          progressPercent: all.length ? Math.round((done / all.length) * 100) : 0,
        });
      }
      if (prevItem) qc.setQueryData<LearnItemDto>(qk.student.item(itemId), { ...prevItem, completed });
      return { prevCourse, prevItem };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevCourse) qc.setQueryData(qk.student.learn(courseId), ctx.prevCourse);
      if (ctx?.prevItem) qc.setQueryData(qk.student.item(itemId), ctx.prevItem);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.student.learn(courseId) });
      void qc.invalidateQueries({ queryKey: qk.student.enrollments });
    },
  });
}

export function useMyAttempts(itemId: string, enabled = true) {
  return useQuery({ queryKey: qk.student.attempts(itemId), queryFn: () => studentApi.attempts(itemId), enabled });
}

export function useStartAttempt(itemId: string) {
  return useMutation({ mutationFn: () => studentApi.startAttempt(itemId) });
}

export function useSubmitAttempt(itemId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, body }: { attemptId: string; body: SubmitAttemptRequest }) =>
      studentApi.submitAttempt(attemptId, body),
    onSuccess: (result) => {
      qc.setQueryData(qk.student.attempt(result.id), result);
      void qc.invalidateQueries({ queryKey: qk.student.attempts(itemId) });
      void qc.invalidateQueries({ queryKey: qk.student.item(itemId) });
      void qc.invalidateQueries({ queryKey: qk.student.learn(courseId) });
      void qc.invalidateQueries({ queryKey: qk.student.enrollments });
    },
  });
}

export function useMyAttempt(attemptId: string | null) {
  return useQuery({
    queryKey: qk.student.attempt(attemptId ?? ""),
    queryFn: () => studentApi.attempt(attemptId as string),
    enabled: !!attemptId,
  });
}
