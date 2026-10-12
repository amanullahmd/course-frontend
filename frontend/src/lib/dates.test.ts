import { de, enUS } from "date-fns/locale";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeVisibility,
  dateLocale,
  formatDate,
  formatDateTime,
  formatRelative,
  isoToLocalInput,
  localInputToIso,
} from "./dates";

// vitest.config.ts pins TZ=UTC, so local time equals UTC here.
const ISO = "2026-03-05T14:07:00Z";

describe("date helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("picks the date-fns locale for the UI language", () => {
    expect(dateLocale("de")).toBe(de);
    expect(dateLocale("en")).toBe(enUS);
    expect(dateLocale(undefined)).toBe(enUS);
    expect(dateLocale("fr")).toBe(enUS);
  });

  it("formats dates in English and German", () => {
    expect(formatDate(ISO, undefined, enUS)).toBe("5 Mar 2026");
    expect(formatDate(ISO, undefined, de)).toBe("5 März 2026");
    expect(formatDate(ISO, "EEEE, d MMMM", de)).toBe("Donnerstag, 5 März");
    expect(formatDateTime(ISO, enUS)).toBe("5 Mar 2026, 14:07");
    expect(formatDate(new Date(ISO), "yyyy-MM-dd")).toBe("2026-03-05");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatDateTime("2026-13-45T99:99:00Z")).toBe("");
    expect(formatRelative(null)).toBe("");
  });

  it("formats relative times with a suffix in both languages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T16:07:00Z"));
    expect(formatRelative(ISO, enUS)).toBe("about 2 hours ago");
    expect(formatRelative(ISO, de)).toBe("vor etwa 2 Stunden");
    expect(formatRelative("2026-03-08T16:07:00Z", enUS)).toBe("in 3 days");
  });

  it("converts between ISO instants and datetime-local values", () => {
    expect(isoToLocalInput(ISO)).toBe("2026-03-05T14:07");
    expect(isoToLocalInput(null)).toBe("");
    expect(localInputToIso("2026-03-05T14:07")).toBe("2026-03-05T14:07:00.000Z");
    expect(localInputToIso(isoToLocalInput(ISO))).toBe(new Date(ISO).toISOString());
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("garbage")).toBeNull();
  });
});

describe("computeVisibility (mirror of the backend rule)", () => {
  const now = Date.parse("2026-06-01T12:00:00Z");
  const before = "2026-06-01T11:59:59Z";
  const after = "2026-06-01T12:00:01Z";

  it("drafts are always DRAFT", () => {
    expect(computeVisibility("DRAFT", null, null, now)).toBe("DRAFT");
    expect(computeVisibility("DRAFT", before, after, now)).toBe("DRAFT");
  });

  it("published without dates is LIVE", () => {
    expect(computeVisibility("PUBLISHED", null, null, now)).toBe("LIVE");
    expect(computeVisibility("PUBLISHED", undefined, undefined, now)).toBe("LIVE");
  });

  it("future publishAt is SCHEDULED, past publishAt is LIVE", () => {
    expect(computeVisibility("PUBLISHED", after, null, now)).toBe("SCHEDULED");
    expect(computeVisibility("PUBLISHED", before, null, now)).toBe("LIVE");
    // publishAt <= now is live (inclusive boundary, like the backend)
    expect(computeVisibility("PUBLISHED", "2026-06-01T12:00:00Z", null, now)).toBe("LIVE");
  });

  it("unpublishAt <= now is EXPIRED (exclusive end)", () => {
    expect(computeVisibility("PUBLISHED", null, before, now)).toBe("EXPIRED");
    expect(computeVisibility("PUBLISHED", null, "2026-06-01T12:00:00Z", now)).toBe("EXPIRED");
    expect(computeVisibility("PUBLISHED", before, after, now)).toBe("LIVE");
  });
});
