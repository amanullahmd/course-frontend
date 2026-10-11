import "server-only";
import type { CatalogQuery, CoursePublicDto, CourseSummaryDto, Page } from "./types";

/** Base URL for server-side rendering (may differ from the browser URL inside Docker). */
const SERVER_API_URL = (process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(
  /\/+$/,
  "",
);

export type ServerResult<T> = { ok: true; data: T } | { ok: false; status: number };

async function serverGet<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<ServerResult<T>> {
  const url = new URL(`${SERVER_API_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function fetchCatalog(query: CatalogQuery): Promise<ServerResult<Page<CourseSummaryDto>>> {
  return serverGet<Page<CourseSummaryDto>>("/api/public/courses", {
    q: query.q,
    level: query.level,
    page: query.page,
    size: query.size,
  });
}

export function fetchPublicCourse(slug: string): Promise<ServerResult<CoursePublicDto>> {
  return serverGet<CoursePublicDto>(`/api/public/courses/${encodeURIComponent(slug)}`);
}
