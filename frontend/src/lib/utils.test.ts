import { describe, expect, it } from "vitest";
import {
  clamp,
  cn,
  fileExtension,
  formatBytes,
  formatMinutes,
  hashString,
  initials,
  moveItem,
  pluralize,
  safeNextPath,
  stripHtml,
} from "./utils";

describe("utils", () => {
  it("cn merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", false && "hidden", undefined, "px-4")).toBe("px-4");
    expect(cn("text-sm", { "font-bold": true, italic: false })).toBe("text-sm font-bold");
  });

  it("initials uses the first and last name", () => {
    expect(initials("Anna Schneider")).toBe("AS");
    expect(initials("  luca   maria  rossi ")).toBe("LR");
    expect(initials("Mehmet")).toBe("M");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });

  it("formatBytes uses binary units with sensible precision", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024)).toBe("10 KB");
    expect(formatBytes(5.25 * 1024 * 1024)).toBe("5.3 MB");
    expect(formatBytes(3 * 1024 ** 4)).toBe("3.0 TB");
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });

  it("formatMinutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
    expect(formatMinutes(0)).toBe("");
    expect(formatMinutes(-5)).toBe("");
    expect(formatMinutes(null)).toBe("");
  });

  it("pluralize", () => {
    expect(pluralize(1, "lesson")).toBe("1 lesson");
    expect(pluralize(2, "lesson")).toBe("2 lessons");
    expect(pluralize(0, "quiz", "quizzes")).toBe("0 quizzes");
  });

  it("hashString is stable and non-negative", () => {
    expect(hashString("Deutsch A1")).toBe(hashString("Deutsch A1"));
    expect(hashString("Deutsch A1")).not.toBe(hashString("Deutsch B1"));
    for (const s of ["", "a", "Prüfungsvorbereitung Goethe B2", "x".repeat(500)]) {
      expect(hashString(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("clamp", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-1, 1, 10)).toBe(1);
    expect(clamp(11, 1, 10)).toBe(10);
  });

  it("fileExtension", () => {
    expect(fileExtension("Arbeitsblatt.PDF")).toBe("pdf");
    expect(fileExtension("archive.tar.gz")).toBe("gz");
    expect(fileExtension("README")).toBe("");
  });

  it("stripHtml produces a plain-text preview", () => {
    expect(stripHtml("<h2>Hallo&nbsp;und</h2><p>Guten <strong>Tag</strong> &amp; tschüss</p>")).toBe(
      "Hallo und Guten Tag & tschüss",
    );
    expect(stripHtml(null)).toBe("");
  });

  it("moveItem returns a reordered copy", () => {
    const list = ["a", "b", "c", "d"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  describe("safeNextPath (post-login redirect target)", () => {
    it("keeps same-site relative paths", () => {
      expect(safeNextPath("/courses/deutsch-a1?tab=outline#m1")).toBe("/courses/deutsch-a1?tab=outline#m1");
      expect(safeNextPath("/learn/123")).toBe("/learn/123");
    });

    it.each([
      ["missing", null],
      ["empty", ""],
      ["absolute URL", "https://evil.example/phish"],
      ["protocol-relative", "//evil.example"],
      ["backslash (browsers treat it as a slash)", "/\\evil.example"],
      ["backslash later in the authority", "/\\/evil.example"],
      ["tab that browsers strip", "/\t/evil.example"],
      ["newline that browsers strip", "/\n/evil.example"],
      ["javascript: URL", "javascript:alert(1)"],
      ["relative without slash", "dashboard"],
    ])("falls back for %s", (_label, value) => {
      expect(safeNextPath(value as string | null, "/home")).toBe("/home");
    });

    it("never resolves to another origin", () => {
      const origin = "https://course.amanullah.me";
      for (const candidate of ["/ok", "//x.y", "/\\x.y", "/\t/x.y", "/%2F%2Fx.y", "/..//x.y"]) {
        const target = safeNextPath(candidate, "/dashboard");
        expect(new URL(target, origin).origin).toBe(origin);
      }
    });
  });
});
