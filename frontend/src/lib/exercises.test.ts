import { describe, expect, it } from "vitest";
import {
  arrayMove,
  blankIndexes,
  blanksAsGaps,
  emptyAnswer,
  formatClock,
  hasDuplicateMarkers,
  insertBlank,
  isAnswered,
  markerNumbers,
  moveBy,
  nextBlankIndex,
  normalizeDraft,
  partialPoints,
  pickRecorderMime,
  reconcileOrder,
  recordingFile,
  removeBlank,
  splitPrompt,
  toSubmitAnswer,
} from "./exercises";

describe("blank markers", () => {
  it("splits a prompt into text and blanks", () => {
    expect(splitPrompt("Ich {{1}} gestern im Kino und {{ 2 }} Film.")).toEqual([
      { kind: "text", text: "Ich " },
      { kind: "blank", index: 1 },
      { kind: "text", text: " gestern im Kino und " },
      { kind: "blank", index: 2 },
      { kind: "text", text: " Film." },
    ]);
    expect(splitPrompt("")).toEqual([]);
    expect(splitPrompt("{{1}}")).toEqual([{ kind: "blank", index: 1 }]);
  });

  it("ignores malformed markers", () => {
    expect(markerNumbers("{{}} {1} {{a}} {{1}")).toEqual([]);
  });

  it("finds distinct sorted blank numbers, duplicates and the next free number", () => {
    expect(blankIndexes("{{2}} {{1}} {{2}}")).toEqual([1, 2]);
    expect(hasDuplicateMarkers("{{2}} {{1}} {{2}}")).toBe(true);
    expect(hasDuplicateMarkers("{{1}} {{2}}")).toBe(false);
    expect(nextBlankIndex("")).toBe(1);
    expect(nextBlankIndex("{{1}} und {{4}}")).toBe(5);
  });

  it("turns a selection into a blank and reports the replaced word", () => {
    const text = "Ich habe gestern gespielt";
    const r = insertBlank(text, 4, 8);
    expect(r).toEqual({ prompt: "Ich {{1}} gestern gespielt", index: 1, selected: "habe" });
    // a trailing space in the selection is kept outside the blank
    expect(insertBlank(text, 4, 9).prompt).toBe("Ich {{1}} gestern gespielt");
    // an empty selection inserts an empty blank at the cursor and numbers on
    expect(insertBlank("Ich {{1}} ", 10, 10)).toEqual({ prompt: "Ich {{1}} {{2}}", index: 2, selected: "" });
  });

  it("removes a blank again, optionally putting text back", () => {
    expect(removeBlank("Ich {{1}} und {{2}}", 1, "habe")).toBe("Ich habe und {{2}}");
    expect(removeBlank("Ich {{ 1 }}", 1)).toBe("Ich ");
    expect(blanksAsGaps("Ich {{1}} und {{2}}")).toBe("Ich ___ und ___");
  });
});

describe("list helpers", () => {
  it("moves items safely", () => {
    expect(arrayMove(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(arrayMove(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(arrayMove(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(moveBy(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveBy(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("reconciles a saved order with the current ids", () => {
    expect(reconcileOrder(["c", "a", "x", "a"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
    expect(reconcileOrder(null, ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("draft answers", () => {
  it("tells when a language question is answered", () => {
    const q = (type: Parameters<typeof isAnswered>[0]["type"]) => ({ type });
    expect(isAnswered(q("CLOZE"), undefined)).toBe(false);
    expect(isAnswered(q("CLOZE"), { ...emptyAnswer, blanks: { "1": "  " } })).toBe(false);
    expect(isAnswered(q("CLOZE"), { ...emptyAnswer, blanks: { "1": "war" } })).toBe(true);
    expect(isAnswered(q("WORD_BANK"), { ...emptyAnswer, blanks: { "2": "id" } })).toBe(true);
    expect(isAnswered(q("MATCHING"), { ...emptyAnswer, pairs: { a: "b" } })).toBe(true);
    expect(isAnswered(q("ORDERING"), { ...emptyAnswer, order: ["a"] })).toBe(true);
    expect(isAnswered(q("SPEAKING"), { ...emptyAnswer, responseMediaId: "m" })).toBe(true);
    expect(isAnswered(q("SPEAKING"), emptyAnswer)).toBe(false);
    expect(isAnswered(q("DICTATION"), { ...emptyAnswer, textAnswer: " Hallo " })).toBe(true);
    expect(isAnswered(q("SINGLE_CHOICE"), { ...emptyAnswer, selectedOptionIds: ["x"] })).toBe(true);
  });

  it("sends only the fields of the question type", () => {
    const d = { ...emptyAnswer, blanks: { "1": "war", "2": " " }, textAnswer: "stray", order: ["a"] };
    expect(toSubmitAnswer({ id: "q", type: "CLOZE" }, d)).toEqual({
      questionId: "q",
      selectedOptionIds: [],
      textAnswer: null,
      blanks: { "1": "war" },
    });
    expect(toSubmitAnswer({ id: "q", type: "ORDERING" }, d).order).toEqual(["a"]);
    expect(toSubmitAnswer({ id: "q", type: "SHORT_ANSWER" }, d).textAnswer).toBe("stray");
    expect(toSubmitAnswer({ id: "q", type: "SPEAKING" }, { ...emptyAnswer, responseMediaId: "m" }).responseMediaId).toBe("m");
    expect(toSubmitAnswer({ id: "q", type: "ESSAY" }, undefined).textAnswer).toBeNull();
  });

  it("normalises drafts from older storage", () => {
    expect(normalizeDraft({ textAnswer: "x" } as never)).toEqual({ ...emptyAnswer, textAnswer: "x" });
    expect(normalizeDraft(null)).toEqual(emptyAnswer);
  });
});

describe("recording helpers", () => {
  it("picks the first supported container", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMime(() => false)).toBeNull();
  });

  it("derives upload file names from the mime type", () => {
    expect(recordingFile("audio/webm;codecs=opus")).toEqual({ name: "aufnahme.webm", type: "audio/webm" });
    expect(recordingFile("audio/mp4")).toEqual({ name: "aufnahme.m4a", type: "audio/mp4" });
    expect(recordingFile("audio/ogg;codecs=opus", "x")).toEqual({ name: "x.ogg", type: "audio/ogg" });
  });

  it("formats clock time", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.4)).toBe("1:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("partial points", () => {
  it("rounds to half points and never reaches full points early", () => {
    expect(partialPoints(4, 2 / 3)).toBe(2.5);
    expect(partialPoints(4, 1)).toBe(4);
    expect(partialPoints(1, 0.9)).toBe(0.5);
    expect(partialPoints(5, 0)).toBe(0);
  });
});
