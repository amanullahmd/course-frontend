import { describe, expect, it } from "vitest";
import { countdown, formatCountdown, googleCalendarUrl, nextSessions, pastSessions, sessionState, webcalUrl } from "./live";

const at = (iso: string) => Date.parse(iso);
const session = (start: string, end: string, cancelled = false) => ({ startsAt: start, endsAt: end, cancelled });

describe("sessionState", () => {
  const s = session("2026-10-12T17:00:00Z", "2026-10-12T18:00:00Z");
  it("walks through upcoming, joinable, running and ended", () => {
    expect(sessionState(s, at("2026-10-12T16:00:00Z"))).toBe("upcoming");
    expect(sessionState(s, at("2026-10-12T16:44:59Z"))).toBe("upcoming");
    expect(sessionState(s, at("2026-10-12T16:45:00Z"))).toBe("joinable");
    expect(sessionState(s, at("2026-10-12T17:00:00Z"))).toBe("running");
    expect(sessionState(s, at("2026-10-12T17:59:59Z"))).toBe("running");
    expect(sessionState(s, at("2026-10-12T18:00:00Z"))).toBe("ended");
  });
  it("a cancelled session is cancelled at any time", () => {
    expect(sessionState({ ...s, cancelled: true }, at("2026-10-12T17:30:00Z"))).toBe("cancelled");
  });
});

describe("countdown", () => {
  it("splits the remaining time", () => {
    const now = at("2026-10-12T10:00:00Z");
    expect(countdown(now + (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000, now)).toEqual({
      days: 2, hours: 3, minutes: 4, seconds: 5, over: false,
    });
    expect(countdown(now - 1, now).over).toBe(true);
    expect(countdown(now, now).over).toBe(true);
  });
  it("formats compactly", () => {
    expect(formatCountdown({ days: 2, hours: 3, minutes: 4, seconds: 5, over: false })).toBe("2d 3h");
    expect(formatCountdown({ days: 0, hours: 3, minutes: 4, seconds: 5, over: false })).toBe("3h 04m");
    expect(formatCountdown({ days: 0, hours: 0, minutes: 12, seconds: 5, over: false })).toBe("12m 05s");
    expect(formatCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, over: true })).toBe("0s");
  });
});

describe("lists and links", () => {
  const now = at("2026-10-12T12:00:00Z");
  const list = [
    { id: "past", ...session("2026-10-10T17:00:00Z", "2026-10-10T18:00:00Z") },
    { id: "later", ...session("2026-10-20T17:00:00Z", "2026-10-20T18:00:00Z") },
    { id: "running", ...session("2026-10-12T11:30:00Z", "2026-10-12T12:30:00Z") },
    { id: "cancelled", ...session("2026-10-14T17:00:00Z", "2026-10-14T18:00:00Z", true) },
  ];
  it("sorts upcoming soonest first and past newest first", () => {
    expect(nextSessions(list, now).map((s) => s.id)).toEqual(["running", "later"]);
    expect(pastSessions(list, now).map((s) => s.id)).toEqual(["cancelled", "past"]);
  });
  it("builds a webcal link", () => {
    expect(webcalUrl("https://api.example.org/api/calendar/abc.ics")).toBe("webcal://api.example.org/api/calendar/abc.ics");
    expect(webcalUrl("http://localhost:8104/x.ics")).toBe("webcal://localhost:8104/x.ics");
  });
});

describe("googleCalendarUrl", () => {
  it("encodes title, UTC times and details", () => {
    const url = new URL(
      googleCalendarUrl({ title: "Sprechstunde & Übung", startsAt: "2026-10-27T17:00:00.000Z", endsAt: "2026-10-27T18:00:00Z" }, "Kurs: A1"),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Sprechstunde & Übung");
    expect(url.searchParams.get("dates")).toBe("20261027T170000Z/20261027T180000Z");
    expect(url.searchParams.get("details")).toBe("Kurs: A1");
  });
});
