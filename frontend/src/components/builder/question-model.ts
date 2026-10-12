import type { MediaDto, QuestionBlankDto, QuestionDto, QuestionOptionDto, QuestionType, SessionQuestion } from "@/lib/api/types";
import { blankIndexes, hasDuplicateMarkers } from "@/lib/exercises";

export interface DraftOption extends QuestionOptionDto {
  key: string;
}
export interface DraftQuestion extends Omit<QuestionDto, "options"> {
  key: string;
  options: DraftOption[];
}

let keyCounter = 0;
export const newKey = () => `k${Date.now().toString(36)}${(keyCounter += 1)}`;

export const MIN_RECORDING_SECONDS = 10;
export const MAX_RECORDING_SECONDS = 600;

const opt = (text: string, correct: boolean, extra: Partial<DraftOption> = {}): DraftOption => ({
  key: newKey(),
  text,
  correct,
  position: 0,
  ...extra,
});

export const isChoice = (t: QuestionType) => t === "SINGLE_CHOICE" || t === "MULTIPLE_CHOICE" || t === "TRUE_FALSE";
export const hasBlanks = (t: QuestionType) => t === "CLOZE" || t === "WORD_BANK";
export const usesOptions = (t: QuestionType) => isChoice(t) || t === "WORD_BANK" || t === "MATCHING" || t === "ORDERING";
export const isTextType = (t: QuestionType) => t === "SHORT_ANSWER" || t === "FILL_BLANK";
export const supportsPartial = (t: QuestionType) => t === "MULTIPLE_CHOICE" || hasBlanks(t) || t === "MATCHING" || t === "ORDERING" || t === "DICTATION";
export const supportsShuffle = (t: QuestionType) => t === "SINGLE_CHOICE" || t === "MULTIPLE_CHOICE" || t === "WORD_BANK" || t === "MATCHING";
export const supportsLenient = (t: QuestionType) => isTextType(t) || t === "CLOZE" || t === "DICTATION";
const referenceAnswers = (t: QuestionType) => isTextType(t) || t === "DICTATION";

export function defaultOptions(type: QuestionType): DraftOption[] {
  switch (type) {
    case "TRUE_FALSE":
      return [opt("Richtig", true), opt("Falsch", false)];
    case "SINGLE_CHOICE":
      return [opt("", true), opt("", false), opt("", false)];
    case "MULTIPLE_CHOICE":
      return [opt("", true), opt("", true), opt("", false), opt("", false)];
    case "MATCHING":
      return [opt("", false, { matchText: "" }), opt("", false, { matchText: "" }), opt("", false, { matchText: "" })];
    case "ORDERING":
      return [opt("", false), opt("", false), opt("", false)];
    default:
      return [];
  }
}

const defaultPoints = (type: QuestionType) => (type === "ESSAY" || type === "SPEAKING" ? 5 : hasBlanks(type) || type === "MATCHING" || type === "ORDERING" || type === "DICTATION" ? 2 : 1);

export function newQuestion(type: QuestionType): DraftQuestion {
  return {
    key: newKey(),
    type,
    prompt: "",
    explanation: null,
    points: defaultPoints(type),
    position: 0,
    caseSensitive: false,
    acceptedAnswers: [],
    mediaId: null,
    media: null,
    options: defaultOptions(type),
    scoring: "ALL_OR_NOTHING",
    shuffleOptions: false,
    lenientSpelling: false,
    maxRecordingSeconds: type === "SPEAKING" ? 60 : null,
    blanks: [],
  };
}

/** Switches the type of a question and keeps what still makes sense (prompt, points, options, answers). */
export function convertType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (type === q.type) return q;
  let options: DraftOption[] = [];
  if (type === "TRUE_FALSE") options = defaultOptions("TRUE_FALSE");
  else if (isChoice(type)) {
    options = isChoice(q.type) && q.type !== "TRUE_FALSE" ? q.options : defaultOptions(type);
    if (type === "SINGLE_CHOICE") {
      const first = options.findIndex((o) => o.correct);
      options = options.map((o, i) => ({ ...o, correct: i === (first < 0 ? 0 : first) }));
    }
  } else if (type === "MATCHING" || type === "ORDERING") {
    const carried = isChoice(q.type) && q.type !== "TRUE_FALSE" ? q.options.filter((o) => o.text.trim()) : [];
    options = carried.length >= 2 ? carried.map((o) => ({ ...o, correct: false, blankIndex: null, matchText: type === "MATCHING" ? "" : null })) : defaultOptions(type);
  }
  const points = (type === "ESSAY" || type === "SPEAKING") && q.points < 2 ? 5 : q.points;
  return {
    ...q,
    type,
    options,
    acceptedAnswers: referenceAnswers(type) ? q.acceptedAnswers : [],
    blanks: type === "CLOZE" ? (q.blanks ?? []) : [],
    points,
    scoring: supportsPartial(type) ? (q.scoring ?? "ALL_OR_NOTHING") : "ALL_OR_NOTHING",
    shuffleOptions: supportsShuffle(type) ? !!q.shuffleOptions : false,
    lenientSpelling: supportsLenient(type) ? !!q.lenientSpelling : false,
    maxRecordingSeconds: type === "SPEAKING" ? (q.maxRecordingSeconds ?? 60) : null,
  };
}

export type QuestionError =
  | "errPrompt"
  | "errPoints"
  | "errTwoOptions"
  | "errEmptyOption"
  | "errCorrect"
  | "errAccepted"
  | "errBlanks"
  | "errBlankDuplicate"
  | "errBlankAnswer"
  | "errChips"
  | "errChipBlank"
  | "errChipText"
  | "errPairs"
  | "errPairText"
  | "errItems"
  | "errItemText"
  | "errAudio"
  | "errReference"
  | "errDuration";

const EXERCISE_ERRORS: ReadonlySet<QuestionError> = new Set([
  "errBlanks",
  "errBlankDuplicate",
  "errBlankAnswer",
  "errChips",
  "errChipBlank",
  "errChipText",
  "errPairs",
  "errPairText",
  "errItems",
  "errItemText",
  "errAudio",
  "errReference",
  "errDuration",
]);

/** Message key (under the root of the messages) for a validation error. */
export const errorMessageKey = (e: QuestionError) => (EXERCISE_ERRORS.has(e) ? `exercises.editor.${e}` : `question.${e}`);

/** Accepted answers of one blank of a CLOZE question (empty when the blank has none yet). */
export function blankAnswers(q: Pick<DraftQuestion, "blanks">, index: number): string[] {
  return q.blanks?.find((b) => b.index === index)?.acceptedAnswers ?? [];
}

export function setBlankAnswers(blanks: QuestionBlankDto[] | undefined, index: number, answers: string[]): QuestionBlankDto[] {
  const rest = (blanks ?? []).filter((b) => b.index !== index);
  return [...rest, { index, acceptedAnswers: answers }].sort((a, b) => a.index - b.index);
}

export function validateQuestion(q: DraftQuestion): QuestionError | null {
  if (!q.prompt.trim()) return "errPrompt";
  if (!(q.points > 0)) return "errPoints";
  if (isChoice(q.type)) {
    if (q.options.length < 2) return "errTwoOptions";
    if (q.options.some((o) => !o.text.trim())) return "errEmptyOption";
    if (!q.options.some((o) => o.correct)) return "errCorrect";
  }
  if (isTextType(q.type) && q.acceptedAnswers.length === 0) return "errAccepted";
  switch (q.type) {
    case "CLOZE": {
      const markers = blankIndexes(q.prompt);
      if (markers.length === 0) return "errBlanks";
      if (hasDuplicateMarkers(q.prompt)) return "errBlankDuplicate";
      if (markers.some((n) => !blankAnswers(q, n).some((a) => a.trim()))) return "errBlankAnswer";
      return null;
    }
    case "WORD_BANK": {
      const markers = blankIndexes(q.prompt);
      if (markers.length === 0) return "errBlanks";
      if (hasDuplicateMarkers(q.prompt)) return "errBlankDuplicate";
      if (q.options.length < Math.max(2, markers.length)) return "errChips";
      if (q.options.some((o) => !o.text.trim())) return "errChipText";
      for (const n of markers) if (q.options.filter((o) => o.blankIndex === n).length !== 1) return "errChipBlank";
      if (q.options.some((o) => o.blankIndex != null && !markers.includes(o.blankIndex))) return "errChipBlank";
      return null;
    }
    case "MATCHING":
      if (q.options.length < 2) return "errPairs";
      if (q.options.some((o) => !o.text.trim() || !(o.matchText ?? "").trim())) return "errPairText";
      return null;
    case "ORDERING":
      if (q.options.length < 2) return "errItems";
      if (q.options.some((o) => !o.text.trim())) return "errItemText";
      return null;
    case "DICTATION":
      if (q.media?.kind !== "AUDIO") return "errAudio";
      if (q.acceptedAnswers.length === 0) return "errReference";
      return null;
    case "SPEAKING": {
      const s = q.maxRecordingSeconds;
      if (!s || !Number.isInteger(s) || s < MIN_RECORDING_SECONDS || s > MAX_RECORDING_SECONDS) return "errDuration";
      return null;
    }
    default:
      return null;
  }
}

/** What the server stores: only the fields that belong to the question type (and blanks that still have a marker). */
export function toQuestionPayload(q: DraftQuestion, position: number): QuestionDto {
  const markers = blankIndexes(q.prompt);
  return {
    ...(q.id ? { id: q.id } : {}),
    type: q.type,
    prompt: q.prompt.trim(),
    explanation: q.explanation?.trim() ? q.explanation : null,
    points: q.points,
    position,
    caseSensitive: q.caseSensitive,
    acceptedAnswers: referenceAnswers(q.type) ? q.acceptedAnswers : [],
    mediaId: q.media?.id ?? q.mediaId ?? null,
    options: usesOptions(q.type)
      ? q.options.map((o, i) => ({
          ...(o.id ? { id: o.id } : {}),
          text: o.text.trim(),
          correct: q.type === "WORD_BANK" ? o.blankIndex != null : q.type === "MATCHING" || q.type === "ORDERING" ? false : o.correct,
          position: i,
          ...(q.type === "MATCHING" ? { matchText: (o.matchText ?? "").trim() } : {}),
          ...(q.type === "WORD_BANK" ? { blankIndex: o.blankIndex ?? null } : {}),
        }))
      : [],
    scoring: supportsPartial(q.type) ? (q.scoring ?? "ALL_OR_NOTHING") : "ALL_OR_NOTHING",
    shuffleOptions: supportsShuffle(q.type) ? !!q.shuffleOptions : false,
    lenientSpelling: supportsLenient(q.type) ? !!q.lenientSpelling : false,
    maxRecordingSeconds: q.type === "SPEAKING" ? (q.maxRecordingSeconds ?? null) : null,
    blanks:
      q.type === "CLOZE"
        ? (q.blanks ?? []).filter((b) => markers.includes(b.index)).map((b) => ({ index: b.index, acceptedAnswers: b.acceptedAnswers.map((a) => a.trim()).filter(Boolean) }))
        : [],
  };
}

/** The learner's view of a draft question, for the live preview in the editor. */
export function toPreviewQuestion(q: DraftQuestion): SessionQuestion {
  const media: MediaDto | null = q.media ?? null;
  const rotate = <T,>(list: T[]) => (list.length > 1 ? [...list.slice(1), list[0]] : list);
  const named = q.options.map((o) => ({ id: o.key, text: o.text || "…" }));
  const base = { id: q.key, type: q.type, prompt: q.prompt, points: q.points, media };
  switch (q.type) {
    case "WORD_BANK":
      return { ...base, options: named, blankCount: blankIndexes(q.prompt).length };
    case "CLOZE":
      return { ...base, options: [], blankCount: blankIndexes(q.prompt).length };
    case "MATCHING":
      return {
        ...base,
        options: named,
        matchTargets: rotate(q.options.map((o) => ({ id: `${o.key}:r`, text: o.matchText || "…" }))),
      };
    case "ORDERING":
      return { ...base, options: rotate(named) };
    case "SPEAKING":
      return { ...base, options: [], maxRecordingSeconds: q.maxRecordingSeconds ?? 60 };
    default:
      return { ...base, options: named };
  }
}
