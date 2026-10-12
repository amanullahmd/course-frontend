import { describe, expect, it } from "vitest";
import { dueState, parsePoints, pointsPercent, pointsProblem } from "./assignments";

const now = Date.parse("2026-10-12T12:00:00Z");

describe("dueState", () => {
  it("classifies the deadline", () => {
    expect(dueState(null, now)).toBe("none");
    expect(dueState("2026-10-11T12:00:00Z", now)).toBe("overdue");
    expect(dueState("2026-10-14T11:59:00Z", now)).toBe("soon");
    expect(dueState("2026-10-20T12:00:00Z", now)).toBe("open");
    expect(dueState("garbage", now)).toBe("none");
  });
});

describe("points", () => {
  it("parses comma and dot decimals", () => {
    expect(parsePoints("7,5")).toBe(7.5);
    expect(parsePoints(" 8 ")).toBe(8);
    expect(parsePoints("")).toBeNull();
    expect(parsePoints("abc")).toBeNull();
  });
  it("validates against the maximum", () => {
    expect(pointsProblem("", 10, true)).toBe("missing");
    expect(pointsProblem("", 10, false)).toBeNull();
    expect(pointsProblem("11", 10, true)).toBe("range");
    expect(pointsProblem("-1", 10, false)).toBe("range");
    expect(pointsProblem("x", 10, false)).toBe("range");
    expect(pointsProblem("10", 10, true)).toBeNull();
  });
  it("computes the share", () => {
    expect(pointsPercent(17.5, 20)).toBe(88);
    expect(pointsPercent(null, 20)).toBeNull();
    expect(pointsPercent(5, 0)).toBeNull();
  });
});
