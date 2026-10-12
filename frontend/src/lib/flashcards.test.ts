import { describe, expect, it } from "vitest";
import {
  accuracyPercent,
  answerCard,
  isArticle,
  isFinished,
  parseBulkLines,
  progressPercent,
  startQueue,
  withArticle,
} from "./flashcards";

const cards = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));

describe("review queue", () => {
  it("moves through the cards in order", () => {
    let q = startQueue(cards.slice(0, 3));
    expect(q.queue.map((c) => c.id)).toEqual(["a", "b", "c"]);
    q = answerCard(q, "GOOD");
    q = answerCard(q, "EASY");
    expect(q.queue.map((c) => c.id)).toEqual(["c"]);
    expect(q.done).toBe(2);
    expect(progressPercent(q)).toBe(67);
    q = answerCard(q, "HARD");
    expect(isFinished(q)).toBe(true);
    expect(q.counts).toEqual({ AGAIN: 0, HARD: 1, GOOD: 1, EASY: 1 });
    expect(accuracyPercent(q)).toBe(100);
  });

  it("brings an 'again' card back a few cards later within the same session", () => {
    let q = startQueue(cards);
    q = answerCard(q, "AGAIN");
    expect(q.queue.map((c) => c.id)).toEqual(["b", "c", "d", "e", "a", "f", "g"]);
    expect(q.done).toBe(0);
    expect(q.total).toBe(7);
  });

  it("repeats an 'again' card at the end of a short queue and counts every answer", () => {
    let q = startQueue(cards.slice(0, 2));
    q = answerCard(q, "AGAIN");
    expect(q.queue.map((c) => c.id)).toEqual(["b", "a"]);
    q = answerCard(q, "GOOD");
    q = answerCard(q, "AGAIN");
    expect(q.queue.map((c) => c.id)).toEqual(["a"]);
    q = answerCard(q, "GOOD");
    expect(isFinished(q)).toBe(true);
    expect(q.answers).toBe(4);
    expect(q.counts.AGAIN).toBe(2);
    expect(accuracyPercent(q)).toBe(50);
    expect(progressPercent(q)).toBe(100);
  });

  it("is safe on an empty queue", () => {
    const q = startQueue([]);
    expect(answerCard(q, "GOOD")).toBe(q);
    expect(accuracyPercent(q)).toBeNull();
    expect(progressPercent(q)).toBe(0);
  });
});

describe("articles", () => {
  it("recognises der, die and das only", () => {
    expect(isArticle("der")).toBe(true);
    expect(isArticle("Der")).toBe(false);
    expect(isArticle("ein")).toBe(false);
    expect(isArticle(null)).toBe(false);
  });

  it("prefixes the article", () => {
    expect(withArticle({ front: "Tisch", article: "der" })).toBe("der Tisch");
    expect(withArticle({ front: "gehen", article: null })).toBe("gehen");
  });
});

describe("bulk lines", () => {
  it("parses front;back with optional article, plural and example", () => {
    expect(parseBulkLines("Tisch;table;der;Tische;Der Tisch ist groß.\ngehen;to go")).toEqual([
      { front: "Tisch", back: "table", article: "der", plural: "Tische", example: "Der Tisch ist groß." },
      { front: "gehen", back: "to go", article: null, plural: "", example: "" },
    ]);
  });

  it("splits a leading article off the word and reads tabs", () => {
    expect(parseBulkLines("die Lampe\tlamp\tLampen")).toEqual([
      { front: "Lampe", back: "lamp", article: "die", plural: "Lampen", example: "" },
    ]);
  });

  it("skips blank and incomplete lines", () => {
    expect(parseBulkLines("\n  \nnur ein Wort\n;leer\nHaus;house\r\n")).toEqual([
      { front: "Haus", back: "house", article: null, plural: "", example: "" },
    ]);
  });
});
