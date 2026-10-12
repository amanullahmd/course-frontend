import type { SubmissionStatus } from "@/lib/api/types";

export type DueState = "none" | "open" | "soon" | "overdue";

const DAY = 24 * 60 * 60 * 1000;

/** "soon" = due within two days. */
export function dueState(dueAt: string | null, now: number): DueState {
  if (!dueAt) return "none";
  const diff = Date.parse(dueAt) - now;
  if (Number.isNaN(diff)) return "none";
  if (diff < 0) return "overdue";
  return diff <= 2 * DAY ? "soon" : "open";
}

export const STATUS_VARIANT: Record<SubmissionStatus, "info" | "warning" | "success"> = {
  SUBMITTED: "info",
  RETURNED: "warning",
  GRADED: "success",
};

/** Parses a points input (comma or dot decimal); null when empty or not a number. */
export function parsePoints(value: string): number | null {
  const v = value.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Validation result for the points field: ok, missing (required for grading), or out of range. */
export function pointsProblem(value: string, max: number, required: boolean): "missing" | "range" | null {
  const n = parsePoints(value);
  if (n === null) return required ? "missing" : value.trim() ? "range" : null;
  return n < 0 || n > max ? "range" : null;
}

/** Share 0–100 of the available points, rounded; null without points. */
export function pointsPercent(points: number | null, max: number): number | null {
  return points === null || max <= 0 ? null : Math.round((points / max) * 100);
}

export function fileCountLabelKey(count: number): "none" | "one" | "other" {
  return count === 0 ? "none" : count === 1 ? "one" : "other";
}
