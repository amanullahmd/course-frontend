"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { certificatesApi, type CertificateSettingsUpdate } from "@/lib/api/certificates";

/** Query keys live under ["student", …] / ["instructor", …] so the existing broad invalidations also refresh them. */
export const certificateKeys = {
  mine: ["student", "certificates"] as const,
  status: (courseId: string) => ["student", "certificate", courseId] as const,
  settings: (courseId: string) => ["instructor", "certificate-settings", courseId] as const,
  issued: (courseId: string) => ["instructor", "certificates", courseId] as const,
  verify: (code: string) => ["public", "certificate", code] as const,
};

export function useMyCertificates(enabled = true) {
  return useQuery({ queryKey: certificateKeys.mine, queryFn: certificatesApi.mine, enabled });
}

/** Learner certificate status; refetched whenever the course progress changes (issuing happens server-side). */
export function useCertificateStatus(courseId: string, progressPercent?: number) {
  return useQuery({
    queryKey: [...certificateKeys.status(courseId), progressPercent ?? null],
    queryFn: () => certificatesApi.status(courseId),
    staleTime: 0,
  });
}

export function useCertificateSettings(courseId: string) {
  return useQuery({ queryKey: certificateKeys.settings(courseId), queryFn: () => certificatesApi.settings(courseId) });
}

export function useUpdateCertificateSettings(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CertificateSettingsUpdate) => certificatesApi.updateSettings(courseId, body),
    onSuccess: (data) => {
      qc.setQueryData(certificateKeys.settings(courseId), data);
      // saving may issue certificates for learners who already qualify
      void qc.invalidateQueries({ queryKey: certificateKeys.issued(courseId) });
    },
  });
}

export function useIssuedCertificates(courseId: string) {
  return useQuery({ queryKey: certificateKeys.issued(courseId), queryFn: () => certificatesApi.issued(courseId) });
}

export function useIssueCertificate(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => certificatesApi.issue(courseId, studentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: certificateKeys.issued(courseId) });
      void qc.invalidateQueries({ queryKey: certificateKeys.settings(courseId) });
    },
  });
}

export function useRevokeCertificate(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => certificatesApi.revoke(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: certificateKeys.issued(courseId) });
      void qc.invalidateQueries({ queryKey: certificateKeys.settings(courseId) });
    },
  });
}

export function useVerifyCertificate(code: string) {
  return useQuery({
    queryKey: certificateKeys.verify(code),
    queryFn: () => certificatesApi.verify(code),
    retry: false,
  });
}
