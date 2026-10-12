/** Learners may join from this long before the start (mirrors the backend rule). */
export const JOIN_WINDOW_MS = 15 * 60 * 1000;

export type SessionState = "cancelled" | "upcoming" | "joinable" | "running" | "ended";

interface Timed {
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
}

/** Where a session is on its timeline: joinable = within 15 minutes before the start, running = started, not ended. */
export function sessionState(s: Timed, now: number): SessionState {
  if (s.cancelled) return "cancelled";
  const start = Date.parse(s.startsAt);
  const end = Date.parse(s.endsAt);
  if (now >= end) return "ended";
  if (now >= start) return "running";
  if (now >= start - JOIN_WINDOW_MS) return "joinable";
  return "upcoming";
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** true when the target has passed */
  over: boolean;
}

export function countdown(targetMs: number, now: number): CountdownParts {
  const diff = targetMs - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    over: false,
  };
}

/** Compact "2d 4h", "3h 05m", "12m 30s" style countdown. */
export function formatCountdown(parts: CountdownParts): string {
  if (parts.over) return "0s";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${pad(parts.minutes)}m`;
  return `${parts.minutes}m ${pad(parts.seconds)}s`;
}

/** Subscription link for calendar apps: webcal:// opens the default calendar application. */
export function webcalUrl(httpUrl: string): string {
  return httpUrl.replace(/^https?:\/\//i, "webcal://");
}

/** Sessions that are not over, soonest first; cancelled ones are dropped. */
export function nextSessions<T extends Timed>(sessions: T[], now: number): T[] {
  return sessions
    .filter((s) => !s.cancelled && Date.parse(s.endsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Past sessions (ended or cancelled), newest first. */
export function pastSessions<T extends Timed>(sessions: T[], now: number): T[] {
  return sessions
    .filter((s) => s.cancelled || Date.parse(s.endsAt) <= now)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

const compactUtc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * "Add to Google Calendar" link for one session. Deliberately without the join URL: learners get that from the
 * course page shortly before the start.
 */
export function googleCalendarUrl(s: { title: string; startsAt: string; endsAt: string }, details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: s.title,
    dates: `${compactUtc(Date.parse(s.startsAt))}/${compactUtc(Date.parse(s.endsAt))}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
