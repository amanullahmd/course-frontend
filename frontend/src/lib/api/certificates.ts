import { api, API_URL, ApiError, getAccessToken, getApiLocale, refreshSession } from "./client";
import type { CefrLevel, Instant, MediaDto, ProblemDetail, StudentRef, Uuid } from "./types";

// ---------------------------------------------------------------------------
// DTOs (see docs/PLAN.md §6 "Certificates")
// ---------------------------------------------------------------------------
export type CertificateLanguage = "LEARNER" | "EN" | "DE";
export type CertificateState = "ACTIVE" | "REVOKED";
export type IssueType = "AUTOMATIC" | "MANUAL";
export type CertificateStatusKind = "NOT_ENABLED" | "IN_PROGRESS" | "ISSUED" | "REVOKED";
export type CriterionKey = "PROGRESS" | "ASSESSMENTS_PASSED" | "AVERAGE_SCORE";

export interface CertificateSettingsDto {
  courseId: Uuid;
  enabled: boolean;
  minProgressPercent: number;
  requireAssessmentsPassed: boolean;
  minAverageScore: number | null;
  showScore: boolean;
  title: string | null;
  level: CefrLevel | null;
  courseLevel: CefrLevel;
  courseTitle: string;
  signerName: string | null;
  signerTitle: string | null;
  signatureImage: MediaDto | null;
  organization: string | null;
  customText: string | null;
  language: CertificateLanguage;
  defaultSignerName: string;
  issuedCount: number;
  updatedAt: Instant | null;
}

export interface CertificateSettingsUpdate {
  enabled: boolean;
  minProgressPercent: number;
  requireAssessmentsPassed: boolean;
  minAverageScore: number | null;
  showScore: boolean;
  title: string | null;
  level: CefrLevel | null;
  signerName: string | null;
  signerTitle: string | null;
  signatureImageId: Uuid | null;
  organization: string | null;
  customText: string | null;
  language: CertificateLanguage;
}

export interface CertificateDto {
  id: Uuid;
  code: string;
  courseId: Uuid;
  courseTitle: string;
  learnerName: string;
  level: CefrLevel;
  title: string | null;
  completedAt: Instant;
  issuedAt: Instant;
  finalScore: number | null;
  instructorName: string;
  organization: string | null;
  status: CertificateState;
  issueType: IssueType;
  revokedAt: Instant | null;
  revokedReason: string | null;
  verificationUrl: string;
  /** Fields that let the UI draw the same certificate as the PDF. */
  signerTitle: string | null;
  customText: string | null;
  showScore: boolean;
  signatureImageUrl: string | null;
  /** Default language of the PDF ("en" | "de"). */
  language: string;
}

export interface InstructorCertificateDto {
  id: Uuid;
  code: string;
  student: StudentRef;
  learnerName: string;
  courseTitle: string;
  level: CefrLevel;
  completedAt: Instant;
  issuedAt: Instant;
  finalScore: number | null;
  status: CertificateState;
  issueType: IssueType;
  issuedByName: string | null;
  revokedAt: Instant | null;
  revokedReason: string | null;
  verificationUrl: string;
}

/** PROGRESS: percent vs. required percent · ASSESSMENTS_PASSED: passed vs. total · AVERAGE_SCORE: percent vs. minimum. */
export interface CriterionDto {
  key: CriterionKey;
  met: boolean;
  current: number | null;
  target: number | null;
  pending: number;
}

export interface CertificateStatusDto {
  status: CertificateStatusKind;
  criteriaMet: boolean;
  criteria: CriterionDto[];
  certificate: CertificateDto | null;
}

export interface VerificationDto {
  code: string;
  valid: boolean;
  revoked: boolean;
  learnerName: string;
  courseTitle: string;
  level: CefrLevel;
  title: string | null;
  completedAt: Instant;
  issuedAt: Instant;
  revokedAt: Instant | null;
  instructorName: string;
  organization: string | null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export const certificatesApi = {
  settings: (courseId: string) =>
    api.get<CertificateSettingsDto>(`/api/instructor/courses/${courseId}/certificate-settings`),
  updateSettings: (courseId: string, body: CertificateSettingsUpdate) =>
    api.put<CertificateSettingsDto>(`/api/instructor/courses/${courseId}/certificate-settings`, body),
  issued: (courseId: string) => api.get<InstructorCertificateDto[]>(`/api/instructor/courses/${courseId}/certificates`),
  issue: (courseId: string, studentId: string) =>
    api.post<InstructorCertificateDto>(`/api/instructor/courses/${courseId}/certificates/issue`, { studentId }),
  revoke: (id: string, reason: string) =>
    api.post<InstructorCertificateDto>(`/api/instructor/certificates/${id}/revoke`, { reason }),

  mine: () => api.get<CertificateDto[]>("/api/student/certificates"),
  status: (courseId: string) => api.get<CertificateStatusDto>(`/api/student/courses/${courseId}/certificate`),

  verify: (code: string) =>
    api.get<VerificationDto>(`/api/public/certificates/${encodeURIComponent(code)}`, undefined, { auth: false }),
};

// ---------------------------------------------------------------------------
// PDF download with the bearer token (a plain <a href> cannot send it)
// ---------------------------------------------------------------------------
function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

async function fetchPdf(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/pdf, application/problem+json",
    "Accept-Language": getApiLocale(),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}${path}`, { headers, credentials: "include" });
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR" }, "Server unreachable");
  }
}

/**
 * Downloads a certificate PDF (`scope` "student" = my certificate, "instructor" = any certificate of my course).
 * Returns the file name.
 */
export async function downloadCertificatePdf(id: string, scope: "student" | "instructor" = "student"): Promise<string> {
  const path = `/api/${scope}/certificates/${id}/pdf`;
  let res = await fetchPdf(path);
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await fetchPdf(path);
  }
  if (!res.ok) {
    let problem: ProblemDetail = {};
    try {
      if ((res.headers.get("content-type") ?? "").includes("json")) problem = (await res.json()) as ProblemDetail;
    } catch {
      problem = {};
    }
    throw new ApiError(res.status, problem);
  }
  const blob = await res.blob();
  const name = fileNameFrom(res.headers.get("content-disposition"), "certificate.pdf");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

/** LinkedIn "Add licence or certification" URL, prefilled with name, organisation, issue date, URL and id. */
export function linkedInAddUrl(c: Pick<CertificateDto, "title" | "courseTitle" | "organization" | "issuedAt" | "verificationUrl" | "code">, defaultTitle: string): string {
  const issued = new Date(c.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `${c.title || defaultTitle}: ${c.courseTitle}`,
    organizationName: c.organization || "Sprachweg",
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: c.verificationUrl,
    certId: c.code,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/** Public path of the verification page for a code. */
export function verifyPath(code: string): string {
  return `/certificates/verify/${encodeURIComponent(code)}`;
}
