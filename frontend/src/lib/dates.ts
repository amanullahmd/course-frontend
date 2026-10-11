import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy"): string {
  const date = toDate(value);
  return date ? format(date, pattern) : "";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, "d MMM yyyy, HH:mm");
}

export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : "";
}

/** ISO instant → value for <input type="datetime-local"> in the user's time zone. */
export function isoToLocalInput(value: string | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

/** <input type="datetime-local"> value → ISO instant (UTC). */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date.toISOString() : null;
}

export function isPast(value: string | null | undefined, now: number): boolean {
  const date = toDate(value);
  return date ? date.getTime() <= now : false;
}

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "local time";
  }
}

/** Client-side mirror of the server visibility rule (used for optimistic updates). */
export function computeVisibility(
  publishStatus: "DRAFT" | "PUBLISHED",
  publishAt: string | null | undefined,
  unpublishAt: string | null | undefined,
  now: number = Date.now(),
): "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED" {
  if (publishStatus === "DRAFT") return "DRAFT";
  if (unpublishAt && new Date(unpublishAt).getTime() <= now) return "EXPIRED";
  if (publishAt && new Date(publishAt).getTime() > now) return "SCHEDULED";
  return "LIVE";
}
