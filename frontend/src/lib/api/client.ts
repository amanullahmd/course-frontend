import type { AuthResponse, MediaDto, ProblemDetail } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
let apiLocale = "en";

/** Active UI locale, sent as Accept-Language so the backend localises errors and e-mails. */
export function setApiLocale(locale: string): void {
  apiLocale = locale;
}

export function getApiLocale(): string {
  return apiLocale;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly title?: string;
  readonly detail?: string;
  readonly fieldErrors: Record<string, string>;
  readonly traceId?: string;

  constructor(status: number, problem: ProblemDetail = {}, fallbackMessage?: string) {
    super(problem.detail || fallbackMessage || problem.title || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = problem.code;
    this.title = problem.title;
    this.detail = problem.detail;
    this.fieldErrors = problem.errors ?? {};
    this.traceId = problem.traceId;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// In-memory session (access token is never persisted)
// ---------------------------------------------------------------------------
type SessionListener = (session: AuthResponse | null) => void;

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
const listeners = new Set<SessionListener>();

const SESSION_HINT = "sw.hasSession";

/** Non-sensitive hint that a refresh cookie probably exists (avoids a 401 for anonymous visitors). */
export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT) === "1";
  } catch {
    return true;
  }
}

export function setSession(session: AuthResponse | null): void {
  try {
    if (session) window.localStorage.setItem(SESSION_HINT, "1");
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    /* storage unavailable */
  }
  accessToken = session?.accessToken ?? null;
  accessTokenExpiresAt = session ? Date.now() + Math.max(0, session.expiresIn) * 1000 : 0;
  listeners.forEach((listener) => listener(session));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Exchanges the http-only refresh cookie for a new access token.
 * Single-flight: concurrent callers share one request, so a rotating refresh
 * token is never used twice.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Accept-Language": apiLocale },
        });
        if (!res.ok) {
          setSession(null);
          return null;
        }
        const session = (await res.json()) as AuthResponse;
        setSession(session);
        return session;
      } catch {
        setSession(null);
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function tokenNeedsRefresh(): boolean {
  return accessToken !== null && accessTokenExpiresAt > 0 && accessTokenExpiresAt - Date.now() < 15_000;
}

// ---------------------------------------------------------------------------
// fetch wrapper
// ---------------------------------------------------------------------------
export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Attach the bearer token and refresh on 401 (default true). */
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseProblem(res: Response): Promise<ProblemDetail> {
  const type = res.headers.get("content-type") ?? "";
  try {
    if (type.includes("json")) return (await res.json()) as ProblemDetail;
    const text = await res.text();
    return text ? { detail: text.slice(0, 300) } : {};
  } catch {
    return {};
  }
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, query, auth = true, signal, headers = {} } = options;
  const finalHeaders: Record<string, string> = { Accept: "application/json", "Accept-Language": apiLocale, ...headers };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (auth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, query), {
      method,
      body: payload,
      headers: finalHeaders,
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, { code: "NETWORK_ERROR" }, "Server unreachable");
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  if (auth && tokenNeedsRefresh()) await refreshSession();

  let res = await send(path, options);
  if (res.status === 401 && auth) {
    const session = await refreshSession();
    if (session) res = await send(path, options);
  }
  if (!res.ok) {
    throw new ApiError(res.status, await parseProblem(res));
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>, opts: Omit<RequestOptions, "method" | "query"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "PUT", body }),
  delete: <T = void>(path: string, opts: Omit<RequestOptions, "method"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Upload with progress (XHR)
// ---------------------------------------------------------------------------
export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

function xhrUpload(file: File, options: UploadOptions): Promise<{ status: number; body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/media`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Accept-Language", apiLocale);
    if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      resolve({ status: xhr.status, body: xhr.responseText, type: xhr.getResponseHeader("content-type") ?? "" });
    xhr.onerror = () => reject(new ApiError(0, { code: "NETWORK_ERROR" }, "Server unreachable"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<MediaDto> {
  if (tokenNeedsRefresh()) await refreshSession();
  let result = await xhrUpload(file, options);
  if (result.status === 401) {
    const session = await refreshSession();
    if (session) {
      options.onProgress?.(0);
      result = await xhrUpload(file, options);
    }
  }
  if (result.status < 200 || result.status >= 300) {
    let problem: ProblemDetail = {};
    try {
      problem = result.type.includes("json") ? (JSON.parse(result.body) as ProblemDetail) : { detail: result.body };
    } catch {
      problem = {};
    }
    if (result.status === 413 && !problem.code) problem.code = "FILE_TOO_LARGE";
    throw new ApiError(result.status, problem);
  }
  return JSON.parse(result.body) as MediaDto;
}
