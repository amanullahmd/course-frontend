import type { FlashcardArticle } from "@/lib/api/types";

/** Colour per article. The word itself and the border style are the non-colour cues. */
export const ARTICLE_META: Record<FlashcardArticle, { className: string; border: "solid" | "dashed" | "dotted" }> = {
  der: { className: "bg-sky-500/10 text-sky-700 ring-sky-600/40 dark:text-sky-300 dark:ring-sky-400/50", border: "solid" },
  die: { className: "bg-rose-500/10 text-rose-700 ring-rose-600/40 dark:text-rose-300 dark:ring-rose-400/50", border: "dashed" },
  das: { className: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/40 dark:text-emerald-300 dark:ring-emerald-400/50", border: "dotted" },
};

export const ARTICLES: FlashcardArticle[] = ["der", "die", "das"];

export function isArticle(value: string | null | undefined): value is FlashcardArticle {
  return value === "der" || value === "die" || value === "das";
}

/** "der Tisch", or just the word when the card has no article. */
export function withArticle(card: { front: string; article: FlashcardArticle | null }): string {
  return card.article ? `${card.article} ${card.front}` : card.front;
}

// ---------------------------------------------------------------------------
// Review session queue (pure, unit tested)
// ---------------------------------------------------------------------------
export type Grade = "AGAIN" | "HARD" | "GOOD" | "EASY";
export const GRADES: Grade[] = ["AGAIN", "HARD", "GOOD", "EASY"];
export const GRADE_KEYS: Record<string, Grade> = { "1": "AGAIN", "2": "HARD", "3": "GOOD", "4": "EASY" };

export interface QueueCard {
  id: string;
}

export interface ReviewQueue<T extends QueueCard> {
  /** Cards still to show; the first one is the current card. */
  queue: T[];
  /** Number of distinct cards that left the queue for good. */
  done: number;
  total: number;
  /** Grades given in this session (including repeats of "again" cards). */
  counts: Record<Grade, number>;
  answers: number;
}

/** A card answered with AGAIN comes back after this many other cards (or at the end of a short queue). */
export const AGAIN_GAP = 4;

export function startQueue<T extends QueueCard>(cards: T[]): ReviewQueue<T> {
  return { queue: [...cards], done: 0, total: cards.length, counts: { AGAIN: 0, HARD: 0, GOOD: 0, EASY: 0 }, answers: 0 };
}

export function answerCard<T extends QueueCard>(state: ReviewQueue<T>, grade: Grade): ReviewQueue<T> {
  if (state.queue.length === 0) return state;
  const [current, ...rest] = state.queue;
  const counts = { ...state.counts, [grade]: state.counts[grade] + 1 };
  if (grade === "AGAIN") {
    const at = Math.min(AGAIN_GAP, rest.length);
    return { ...state, counts, answers: state.answers + 1, queue: [...rest.slice(0, at), current, ...rest.slice(at)] };
  }
  return { ...state, counts, answers: state.answers + 1, queue: rest, done: state.done + 1 };
}

export function isFinished(state: ReviewQueue<QueueCard>): boolean {
  return state.queue.length === 0;
}

/** Share of answers that were not "again", 0–100 (null before the first answer). */
export function accuracyPercent(state: ReviewQueue<QueueCard>): number | null {
  if (state.answers === 0) return null;
  return Math.round(((state.answers - state.counts.AGAIN) / state.answers) * 100);
}

/** Progress of the session 0–100: distinct cards finished / cards in the session. */
export function progressPercent(state: ReviewQueue<QueueCard>): number {
  return state.total === 0 ? 0 : Math.round((state.done / state.total) * 100);
}

// ---------------------------------------------------------------------------
// CSV helpers for the editor's "bulk add" (one card per line: front;back or front<TAB>back)
// ---------------------------------------------------------------------------
export interface DraftRow {
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string;
  example: string;
}

/** Parses pasted lines "der Tisch;table;Tische" or "Tisch<TAB>table<TAB>der". Lines with fewer than two cells are skipped. */
export function parseBulkLines(text: string): DraftRow[] {
  const rows: DraftRow[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const delimiter = line.includes("\t") ? "\t" : ";";
    const cells = line.split(delimiter).map((c) => c.trim());
    if (cells.length < 2 || !cells[0] || !cells[1]) continue;
    let front = cells[0];
    let article: FlashcardArticle | null = isArticle(cells[2]?.toLowerCase()) ? (cells[2].toLowerCase() as FlashcardArticle) : null;
    // "der Tisch" in the first cell: split the article off
    const m = /^(der|die|das)\s+(.+)$/i.exec(front);
    if (m && !article) {
      article = m[1].toLowerCase() as FlashcardArticle;
      front = m[2];
    }
    const plural = isArticle(cells[2]?.toLowerCase()) ? (cells[3] ?? "") : (cells[2] ?? "");
    const example = isArticle(cells[2]?.toLowerCase()) ? (cells[4] ?? "") : (cells[3] ?? "");
    rows.push({ front, back: cells[1], article, plural, example });
  }
  return rows;
}
