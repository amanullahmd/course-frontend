"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { privacyApi, privacyKeys } from "@/lib/api/privacy";

/** Storage used by the signed-in user's uploads and their quota. */
export function useStorageUsage(enabled = true) {
  return useQuery({ queryKey: privacyKeys.usage, queryFn: privacyApi.usage, enabled, staleTime: 30_000 });
}

export function useInstructorDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) =>
      approve ? privacyApi.approveInstructor(id) : privacyApi.rejectInstructor(id, reason),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
