import { API_URL, ApiError, api, getAccessToken, getApiLocale, refreshSession } from "./client";
import type { AdminUserDto, ProblemDetail } from "./types";

// ---------------------------------------------------------------------------
// Security & privacy: storage usage, data export, account deletion, instructor approval
// ---------------------------------------------------------------------------

/** `GET /api/media/usage`: bytes used by the caller's uploads; `quotaBytes` null = unlimited (admins). */
export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number | null;
}

export interface DeleteAccountRequest {
  password: string;
  /** Must be the literal word "DELETE". */
  confirm: string;
}

export const privacyKeys = {
  usage: ["media", "usage"] as const,
};

async function fetchExport(): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_URL}/api/users/me/export`, {
    credentials: "include",
    headers: {
      Accept: "application/zip, application/problem+json",
      "Accept-Language": getApiLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** Downloads the ZIP with all personal data and returns its file name. */
async function downloadExport(): Promise<string> {
  let res: Response;
  try {
    res = await fetchExport();
    if (res.status === 401 && (await refreshSession())) res = await fetchExport();
  } catch {
    throw new ApiError(0, { code: "NETWORK_ERROR" }, "Server unreachable");
  }
  if (!res.ok) {
    let problem: ProblemDetail = {};
    try {
      problem = (await res.json()) as ProblemDetail;
    } catch {
      problem = {};
    }
    throw new ApiError(res.status, problem);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "sprachweg-data.zip";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}

export const privacyApi = {
  usage: () => api.get<StorageUsage>("/api/media/usage"),
  downloadExport,
  deleteAccount: (body: DeleteAccountRequest) => api.delete<void>("/api/users/me", { body }),
  approveInstructor: (id: string) => api.post<AdminUserDto>(`/api/admin/users/${id}/approve-instructor`),
  rejectInstructor: (id: string, reason?: string) =>
    api.post<AdminUserDto>(`/api/admin/users/${id}/reject-instructor`, { reason: reason?.trim() || null }),
};
