import type { MediaDto, SavedAnswer, SessionQuestion, SubmitAnswer } from "@/lib/api/types";

/* ------------------------------------------------------------------ blank markers ({{1}}, {{2}}, ...) */

export type PromptPart = { kind: "text"; text: string } | { kind: "blank"; index: number };

const MARKER_SOURCE = String.raw`\{\{\s*(\d{1,3})\s*\}\}`;

/** Splits a CLOZE / WORD_BANK prompt into text and numbered blanks. */
export function splitPrompt(prompt: string): PromptPart[] {
  const parts: PromptPart[] = [];
  const re = new RegExp(MARKER_SOURCE, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    if (m.index > last) parts.push({ kind: "text", text: prompt.slice(last, m.index) });
    parts.push({ kind: "blank", index: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < prompt.length) parts.push({ kind: "text", text: prompt.slice(last) });
  return parts;
}

/** Marker numbers in order of appearance. */
export function markerNumbers(prompt: string): number[] {
  return splitPrompt(prompt).flatMap((p) => (p.kind === "blank" ? [p.index] : []));
}

/** Distinct marker numbers, ascending. */
export function blankIndexes(prompt: string): number[] {
  return [...new Set(markerNumbers(prompt))].sort((a, b) => a - b);
}

export function hasDuplicateMarkers(prompt: string): boolean {
  const all = markerNumbers(prompt);
  return new Set(all).size !== all.length;
}

/** The next free blank number (largest used + 1, at least 1). */
export function nextBlankIndex(prompt: string): number {
  const used = markerNumbers(prompt);
  return used.length === 0 ? 1 : Math.max(...used) + 1;
}

/**
 * Turns the selected text (or an empty selection) into the next numbered blank. Returns the new prompt, the new
 * blank number and the replaced text (to be offered as the first accepted answer).
 */
export function insertBlank(prompt: string, start: number, end: number): { prompt: string; index: number; selected: string } {
  const from = Math.max(0, Math.min(start, end, prompt.length));
  const to = Math.max(0, Math.min(Math.max(start, end), prompt.length));
  const index = nextBlankIndex(prompt);
  const raw = prompt.slice(from, to).trimEnd();
  const selected = raw.trim();
  const before = prompt.slice(0, from);
  const after = prompt.slice(from + raw.length);
  return { prompt: `${before}{{${index}}}${after}`, index, selected };
}

/** Replaces a blank marker by plain text again. */
export function removeBlank(prompt: string, index: number, replacement = ""): string {
  return prompt.replace(new RegExp(String.raw`\{\{\s*${index}\s*\}\}`, "g"), replacement);
}

/** Prompt with every blank shown as "___" (for plain-text places such as summaries). */
export function blanksAsGaps(prompt: string): string {
  return prompt.replace(new RegExp(MARKER_SOURCE, "g"), "___");
}

/* ------------------------------------------------------------------ list helpers */

export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveBy<T>(list: readonly T[], index: number, delta: number): T[] {
  return arrayMove(list, index, index + delta);
}

/** Keeps the saved order where ids still exist and appends new ids, so a stale order never loses an item. */
export function reconcileOrder(saved: readonly string[] | undefined | null, ids: readonly string[]): string[] {
  const valid = new Set(ids);
  const kept = (saved ?? []).filter((id, i, all) => valid.has(id) && all.indexOf(id) === i);
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

/* ------------------------------------------------------------------ learner draft answers */

export interface DraftAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
  /** CLOZE: typed text, WORD_BANK: chip id, by blank number. */
  blanks: Record<string, string>;
  /** MATCHING: left option id to right option id. */
  pairs: Record<string, string>;
  /** ORDERING: option ids. */
  order: string[];
  /** SPEAKING: the uploaded recording. */
  responseMediaId: string | null;
  responseMedia: MediaDto | null;
}

export const emptyAnswer: DraftAnswer = {
  selectedOptionIds: [],
  textAnswer: "",
  blanks: {},
  pairs: {},
  order: [],
  responseMediaId: null,
  responseMedia: null,
};

/** Fills in fields that older stored drafts (or partial server data) do not have. */
export function normalizeDraft(a: Partial<DraftAnswer> | null | undefined): DraftAnswer {
  return {
    selectedOptionIds: a?.selectedOptionIds ?? [],
    textAnswer: a?.textAnswer ?? "",
    blanks: a?.blanks ?? {},
    pairs: a?.pairs ?? {},
    order: a?.order ?? [],
    responseMediaId: a?.responseMediaId ?? null,
    responseMedia: a?.responseMedia ?? null,
  };
}

export function draftFromSaved(a: SavedAnswer): DraftAnswer {
  return normalizeDraft({
    selectedOptionIds: a.selectedOptionIds ?? [],
    textAnswer: a.textAnswer ?? "",
    blanks: a.blanks ?? {},
    pairs: a.pairs ?? {},
    order: a.order ?? [],
    responseMediaId: a.responseMediaId ?? null,
    responseMedia: a.responseMedia ?? null,
  });
}

const hasValues = (record: Record<string, string>) => Object.values(record).some((v) => v.trim().length > 0);

export function isAnswered(q: Pick<SessionQuestion, "type">, a: DraftAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return a.selectedOptionIds.length > 0;
    case "CLOZE":
    case "WORD_BANK":
      return hasValues(a.blanks);
    case "MATCHING":
      return Object.keys(a.pairs).length > 0;
    case "ORDERING":
      return a.order.length > 0;
    case "SPEAKING":
      return !!a.responseMediaId;
    default:
      return a.textAnswer.trim().length > 0;
  }
}

/** The request body entry for one question: only the fields that belong to its type are sent. */
export function toSubmitAnswer(q: Pick<SessionQuestion, "id" | "type">, a: DraftAnswer | undefined): SubmitAnswer {
  const d = normalizeDraft(a);
  const base: SubmitAnswer = {
    questionId: q.id,
    selectedOptionIds: [],
    textAnswer: null,
  };
  switch (q.type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
      return { ...base, selectedOptionIds: d.selectedOptionIds };
    case "CLOZE":
    case "WORD_BANK": {
      const blanks = Object.fromEntries(Object.entries(d.blanks).filter(([, v]) => v.trim().length > 0));
      return { ...base, blanks };
    }
    case "MATCHING":
      return { ...base, pairs: d.pairs };
    case "ORDERING":
      return { ...base, order: d.order };
    case "SPEAKING":
      return { ...base, responseMediaId: d.responseMediaId };
    default:
      return { ...base, textAnswer: d.textAnswer.trim() ? d.textAnswer : null };
  }
}

/* ------------------------------------------------------------------ audio recording */

const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] as const;

/** First container the browser can record: webm/opus (Chrome, Firefox, Edge), mp4 (Safari) or ogg. */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string | null {
  return RECORDER_MIME_CANDIDATES.find((m) => isSupported(m)) ?? null;
}

/** File name and type to upload a recording with; the server decides by extension and content. */
export function recordingFile(mime: string, baseName = "aufnahme"): { name: string; type: string } {
  const type = mime.split(";")[0].toLowerCase();
  const ext = type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
  return { name: `${baseName}.${ext}`, type: type || "audio/webm" };
}

/** m:ss for a number of seconds. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ partial credit preview */

/** Points shown for a fraction of a question, rounded to half points like the server does (never full unless 1). */
export function partialPoints(points: number, fraction: number): number {
  if (fraction >= 1) return points;
  if (fraction <= 0 || points <= 0) return 0;
  return Math.min(Math.round(points * fraction * 2) / 2, Math.max(0, points - 0.5));
}
