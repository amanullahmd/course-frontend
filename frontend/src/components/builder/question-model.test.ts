import { describe, expect, it } from "vitest";
import type { MediaDto } from "@/lib/api/types";
import {
  blankAnswers,
  convertType,
  errorMessageKey,
  newQuestion,
  setBlankAnswers,
  toPreviewQuestion,
  toQuestionPayload,
  validateQuestion,
  type DraftOption,
  type DraftQuestion,
} from "./question-model";

const audio = { id: "m1", kind: "AUDIO", url: "http://x/a.wav", fileName: "a.wav" } as MediaDto;
const option = (text: string, extra: Partial<DraftOption> = {}): DraftOption => ({ key: text + Math.random(), text, correct: false, position: 0, ...extra });
const question = (patch: Partial<DraftQuestion>): DraftQuestion => ({ ...newQuestion("CLOZE"), prompt: "x", ...patch });

describe("validateQuestion for language types", () => {
  it("needs numbered blanks with answers for CLOZE", () => {
    expect(validateQuestion(question({ prompt: "keine Lücke" }))).toBe("errBlanks");
    expect(validateQuestion(question({ prompt: "Ich {{1}} und {{1}}", blanks: [{ index: 1, acceptedAnswers: ["bin"] }] }))).toBe("errBlankDuplicate");
    expect(validateQuestion(question({ prompt: "Ich {{1}} und {{2}}", blanks: [{ index: 1, acceptedAnswers: ["bin"] }] }))).toBe("errBlankAnswer");
    expect(
      validateQuestion(question({ prompt: "Ich {{1}} und {{2}}", blanks: [{ index: 1, acceptedAnswers: ["bin"] }, { index: 2, acceptedAnswers: [" ", "habe"] }] })),
    ).toBeNull();
  });

  it("needs one correct chip per blank for WORD_BANK", () => {
    const q = question({ type: "WORD_BANK", prompt: "A {{1}} B {{2}}" });
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 })] })).toBe("errChips");
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 }), option("")] })).toBe("errChipText");
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 }), option("b"), option("c")] })).toBe("errChipBlank");
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 }), option("b", { blankIndex: 1 }), option("c", { blankIndex: 2 })] })).toBe("errChipBlank");
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 }), option("b", { blankIndex: 2 }), option("c")] })).toBeNull();
    expect(validateQuestion({ ...q, options: [option("a", { blankIndex: 1 }), option("b", { blankIndex: 2 }), option("c", { blankIndex: 7 })] })).toBe("errChipBlank");
  });

  it("checks pairs, items, dictation audio and speaking length", () => {
    const m = question({ type: "MATCHING" });
    expect(validateQuestion({ ...m, options: [option("a", { matchText: "x" })] })).toBe("errPairs");
    expect(validateQuestion({ ...m, options: [option("a", { matchText: "x" }), option("b", { matchText: " " })] })).toBe("errPairText");
    expect(validateQuestion({ ...m, options: [option("a", { matchText: "x" }), option("b", { matchText: "x" })] })).toBeNull();
    const o = question({ type: "ORDERING" });
    expect(validateQuestion({ ...o, options: [option("a")] })).toBe("errItems");
    expect(validateQuestion({ ...o, options: [option("a"), option("")] })).toBe("errItemText");
    expect(validateQuestion({ ...o, options: [option("a"), option("b")] })).toBeNull();
    const d = question({ type: "DICTATION" });
    expect(validateQuestion(d)).toBe("errAudio");
    expect(validateQuestion({ ...d, media: audio })).toBe("errReference");
    expect(validateQuestion({ ...d, media: audio, acceptedAnswers: ["Hallo."] })).toBeNull();
    const s = question({ type: "SPEAKING" });
    expect(validateQuestion({ ...s, maxRecordingSeconds: 5 })).toBe("errDuration");
    expect(validateQuestion({ ...s, maxRecordingSeconds: 601 })).toBe("errDuration");
    expect(validateQuestion({ ...s, maxRecordingSeconds: null })).toBe("errDuration");
    expect(validateQuestion({ ...s, maxRecordingSeconds: 60 })).toBeNull();
  });

  it("keeps the old checks", () => {
    expect(validateQuestion(question({ type: "SHORT_ANSWER", prompt: "" }))).toBe("errPrompt");
    expect(validateQuestion(question({ type: "SHORT_ANSWER", acceptedAnswers: [] }))).toBe("errAccepted");
    expect(validateQuestion(question({ type: "ESSAY" }))).toBeNull();
  });

  it("maps errors to message keys", () => {
    expect(errorMessageKey("errPrompt")).toBe("question.errPrompt");
    expect(errorMessageKey("errChips")).toBe("exercises.editor.errChips");
  });
});

describe("question model helpers", () => {
  it("creates sensible defaults per type", () => {
    expect(newQuestion("SPEAKING")).toMatchObject({ points: 5, maxRecordingSeconds: 60 });
    expect(newQuestion("MATCHING").options).toHaveLength(3);
    expect(newQuestion("ORDERING").options.every((o) => o.text === "")).toBe(true);
    expect(newQuestion("CLOZE")).toMatchObject({ points: 2, scoring: "ALL_OR_NOTHING", blanks: [] });
  });

  it("converts types and drops what no longer applies", () => {
    const choice = { ...newQuestion("MULTIPLE_CHOICE"), options: [option("a", { correct: true }), option("b"), option("c")], scoring: "PARTIAL" as const };
    const toOrdering = convertType(choice, "ORDERING");
    expect(toOrdering.options.map((o) => o.text)).toEqual(["a", "b", "c"]);
    expect(toOrdering.options.every((o) => !o.correct)).toBe(true);
    expect(toOrdering.scoring).toBe("PARTIAL");
    const toShort = convertType(choice, "SHORT_ANSWER");
    expect(toShort.scoring).toBe("ALL_OR_NOTHING");
    expect(toShort.options).toEqual([]);
    expect(convertType(newQuestion("ESSAY"), "SPEAKING").maxRecordingSeconds).toBe(60);
    expect(convertType(newQuestion("SPEAKING"), "ESSAY").maxRecordingSeconds).toBeNull();
    expect(convertType(newQuestion("SHORT_ANSWER"), "SHORT_ANSWER")).toEqual(expect.objectContaining({ type: "SHORT_ANSWER" }));
  });

  it("edits accepted answers per blank", () => {
    const blanks = setBlankAnswers([{ index: 2, acceptedAnswers: ["b"] }], 1, ["a"]);
    expect(blanks.map((b) => b.index)).toEqual([1, 2]);
    expect(setBlankAnswers(blanks, 2, ["c"])[1].acceptedAnswers).toEqual(["c"]);
    expect(blankAnswers({ blanks }, 1)).toEqual(["a"]);
    expect(blankAnswers({ blanks: undefined }, 1)).toEqual([]);
  });

  it("builds the server payload per type", () => {
    const cloze = question({ prompt: " Ich {{1}} ", blanks: [{ index: 1, acceptedAnswers: [" war "] }, { index: 9, acceptedAnswers: ["orphan"] }], acceptedAnswers: ["stale"] });
    const payload = toQuestionPayload(cloze, 3);
    expect(payload).toMatchObject({ prompt: "Ich {{1}}", position: 3, acceptedAnswers: [], options: [], blanks: [{ index: 1, acceptedAnswers: ["war"] }] });
    const bank = toQuestionPayload(question({ type: "WORD_BANK", prompt: "{{1}}", options: [option("a", { blankIndex: 1 }), option("b", { correct: true })] }), 0);
    expect(bank.options.map((o) => [o.correct, o.blankIndex])).toEqual([[true, 1], [false, null]]);
    const matching = toQuestionPayload(question({ type: "MATCHING", options: [option(" Tisch ", { matchText: " der " }), option("Lampe", { matchText: "die" })] }), 0);
    expect(matching.options[0]).toMatchObject({ text: "Tisch", matchText: "der", correct: false });
    expect(toQuestionPayload(question({ type: "SPEAKING", maxRecordingSeconds: 30 }), 0).maxRecordingSeconds).toBe(30);
    expect(toQuestionPayload(question({ type: "ESSAY", maxRecordingSeconds: 30, scoring: "PARTIAL" }), 0)).toMatchObject({ maxRecordingSeconds: null, scoring: "ALL_OR_NOTHING" });
  });

  it("builds a preview that matches the learner session shape", () => {
    const matching = toPreviewQuestion(question({ type: "MATCHING", options: [option("a", { matchText: "1" }), option("b", { matchText: "2" })] }));
    expect(matching.matchTargets?.map((t) => t.text)).toEqual(["2", "1"]);
    expect(toPreviewQuestion(question({ type: "CLOZE", prompt: "{{1}} {{2}}" })).blankCount).toBe(2);
    expect(toPreviewQuestion(question({ type: "SPEAKING", maxRecordingSeconds: 45 })).maxRecordingSeconds).toBe(45);
  });
});
