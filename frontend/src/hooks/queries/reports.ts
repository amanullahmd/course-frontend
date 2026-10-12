"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { downloadFile, reportsApi } from "@/lib/api/reports";
import { useErrorMessage } from "@/hooks/use-error-message";

/** Query keys of the instructor reports (all below ["instructor", "reports"], so instructor invalidations refresh them). */
export const reportKeys = {
  all: ["instructor", "reports"] as const,
  overview: (courseId: string) => ["instructor", "reports", "overview", courseId] as const,
  gradebook: (courseId: string) => ["instructor", "reports", "gradebook", courseId] as const,
  student: (courseId: string, studentId: string) => ["instructor", "reports", "student", courseId, studentId] as const,
  assessment: (itemId: string) => ["instructor", "reports", "assessment", itemId] as const,
};

const STALE = 30_000;

export function useCourseOverviewReport(courseId: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.overview(courseId),
    queryFn: () => reportsApi.overview(courseId),
    enabled,
    staleTime: STALE,
  });
}

export function useGradebook(courseId: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.gradebook(courseId),
    queryFn: () => reportsApi.gradebook(courseId),
    enabled,
    staleTime: STALE,
  });
}

export function useStudentReport(courseId: string, studentId: string) {
  return useQuery({
    queryKey: reportKeys.student(courseId, studentId),
    queryFn: () => reportsApi.student(courseId, studentId),
    staleTime: STALE,
    retry: (count, error) => count < 2 && !(error && "status" in error && (error as { status: number }).status < 500),
  });
}

export function useAssessmentAnalytics(itemId: string, enabled = true) {
  return useQuery({
    queryKey: reportKeys.assessment(itemId),
    queryFn: () => reportsApi.assessment(itemId),
    enabled,
    staleTime: STALE,
  });
}

/** Authenticated CSV download with a pending state and localized error toasts. */
export function useDownload() {
  const t = useTranslations("reports");
  const message = useErrorMessage();
  const [pending, setPending] = React.useState<string | null>(null);
  const download = React.useCallback(
    async (path: string, fallbackName?: string) => {
      setPending(path);
      try {
        const name = await downloadFile(path, fallbackName);
        toast.success(t("downloaded", { name }));
      } catch (error) {
        toast.error(t("downloadFailed"), { description: message(error) });
      } finally {
        setPending(null);
      }
    },
    [message, t],
  );
  return { download, pending };
}
