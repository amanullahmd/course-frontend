import { describe, expect, it } from "vitest";
import { VISIBILITY_META, ENROLLMENT_STATUS_META, CEFR_LEVELS, CEFR_META, ITEM_TYPES, ITEM_TYPE_META, isAssessmentType } from "./constants";
import { getEmbedInfo, isVideoEmbed } from "./embed";
import { makeEmailSchema, makePasswordSchema, passwordStrength } from "./validation";

describe("getEmbedInfo", () => {
  it("turns YouTube links into privacy-friendly embed URLs", () => {
    const expected = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "  https://www.youtube.com/live/dQw4w9WgXcQ  ",
    ]) {
      expect(getEmbedInfo(url), url).toEqual({ provider: "youtube", embedUrl: expected, label: "YouTube" });
    }
    expect(getEmbedInfo("https://www.youtube.com/channel/abc")?.embedUrl).toBeNull();
  });

  it("supports Vimeo, Google Docs, H5P and LearningApps", () => {
    expect(getEmbedInfo("https://vimeo.com/76979871")?.embedUrl).toBe("https://player.vimeo.com/video/76979871");
    expect(getEmbedInfo("https://docs.google.com/presentation/d/abc/edit?usp=sharing")?.embedUrl).toBe(
      "https://docs.google.com/presentation/d/abc/preview",
    );
    expect(getEmbedInfo("https://drive.google.com/file/d/xyz/view")?.embedUrl).toBe("https://drive.google.com/file/d/xyz/preview");
    expect(getEmbedInfo("https://school.h5p.com/content/123")?.provider).toBe("h5p");
    expect(getEmbedInfo("https://learningapps.org/watch?v=p1")?.provider).toBe("learningapps");
  });

  it("does not embed unknown sites or non-http URLs", () => {
    expect(getEmbedInfo("https://example.org/page")).toEqual({ provider: "generic", embedUrl: null, label: "example.org" });
    expect(getEmbedInfo("javascript:alert(1)")).toBeNull();
    expect(getEmbedInfo("data:text/html,<script>")).toBeNull();
    expect(getEmbedInfo("not a url")).toBeNull();
    expect(getEmbedInfo(null)).toBeNull();
  });

  it("isVideoEmbed", () => {
    expect(isVideoEmbed("https://youtu.be/abc")).toBe(true);
    expect(isVideoEmbed("https://vimeo.com/123456")).toBe(true);
    expect(isVideoEmbed("https://docs.google.com/document/d/x/edit")).toBe(false);
  });
});

describe("validation", () => {
  const t = (key: string) => `t:${key}`;

  it("password schema mirrors the backend rule (8-64 chars, a letter and a digit)", () => {
    const schema = makePasswordSchema(t);
    expect(schema.safeParse("Password123!").success).toBe(true);
    expect(schema.safeParse("abcdefg1").success).toBe(true);
    const messages = (value: string) => schema.safeParse(value).error?.issues.map((i) => i.message) ?? [];
    expect(messages("a1")).toContain("t:passwordMin");
    expect(messages("x".repeat(64) + "1")).toContain("t:passwordMax");
    expect(messages("12345678")).toContain("t:passwordLetter");
    expect(messages("abcdefgh")).toContain("t:passwordDigit");
  });

  it("email schema trims and validates", () => {
    const schema = makeEmailSchema(t);
    expect(schema.parse("student@sprachweg.de")).toBe("student@sprachweg.de");
    expect(schema.safeParse("not-an-email").error?.issues[0].message).toBe("t:email");
  });

  it("passwordStrength grows with length and variety", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("abcdefg1")).toBe(1);
    expect(passwordStrength("Abcdefgh1234")).toBe(3);
    expect(passwordStrength("Abcdefgh1234!")).toBe(4);
  });
});

describe("badge metadata", () => {
  it("has styles for every visibility state and enrollment status", () => {
    expect(Object.keys(VISIBILITY_META).sort()).toEqual(["DRAFT", "EXPIRED", "LIVE", "SCHEDULED"]);
    expect(Object.keys(ENROLLMENT_STATUS_META).sort()).toEqual(["APPROVED", "PENDING", "REJECTED", "REVOKED", "WITHDRAWN"]);
    for (const meta of Object.values(VISIBILITY_META)) expect(meta.className).toMatch(/\S/);
  });

  it("covers every CEFR level and item type", () => {
    expect(CEFR_LEVELS).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    for (const level of CEFR_LEVELS) expect(CEFR_META[level].dot).toMatch(/^bg-/);
    for (const type of ITEM_TYPES) expect(ITEM_TYPE_META[type].icon).toBeTruthy();
    expect(ITEM_TYPES.filter(isAssessmentType)).toEqual(["QUIZ", "EXAM"]);
  });
});
