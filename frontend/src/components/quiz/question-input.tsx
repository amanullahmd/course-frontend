"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { SessionQuestion } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/learn/audio-player";
import { InlineHtml } from "@/components/course/rich-content";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface DraftAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
}

export const emptyAnswer: DraftAnswer = { selectedOptionIds: [], textAnswer: "" };

export function isAnswered(q: SessionQuestion, a: DraftAnswer | undefined): boolean {
  if (!a) return false;
  if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" || q.type === "TRUE_FALSE") return a.selectedOptionIds.length > 0;
  return a.textAnswer.trim().length > 0;
}

export function QuestionMedia({ media }: { media: SessionQuestion["media"] }) {
  if (!media) return null;
  if (media.kind === "AUDIO") return <AudioPlayer src={media.url} title="Listen carefully" compact />;
  if (media.kind === "IMAGE")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed media URL
      <img src={media.url} alt="Question illustration" className="max-h-80 w-auto rounded-xl border object-contain" />
    );
  if (media.kind === "VIDEO") return <video src={media.url} controls className="aspect-video w-full rounded-xl border bg-black" />;
  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
      Open attached file ({media.fileName})
    </a>
  );
}

/** Renders the prompt; "___" gaps in fill-in-the-blank prompts are highlighted. */
export function QuestionPrompt({ prompt, type }: { prompt: string; type: SessionQuestion["type"] }) {
  if (type !== "FILL_BLANK" || !prompt.includes("___")) {
    return (
      <p className="text-lg leading-relaxed font-medium">
        <InlineHtml html={prompt} />
      </p>
    );
  }
  const parts = prompt.split(/_{3,}/);
  return (
    <p className="text-lg leading-relaxed font-medium whitespace-pre-line">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="mx-1 inline-block min-w-16 border-b-2 border-dashed border-brand align-baseline" aria-label="blank" />
          )}
        </React.Fragment>
      ))}
    </p>
  );
}

export function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  const id = `q-${question.id}`;
  switch (question.type) {
    case "SINGLE_CHOICE":
    case "TRUE_FALSE":
    case "MULTIPLE_CHOICE": {
      const multi = question.type === "MULTIPLE_CHOICE";
      return (
        <div role={multi ? "group" : "radiogroup"} aria-labelledby={`${id}-prompt`} className="grid gap-2.5">
          {multi && <p className="text-xs text-muted-foreground">Select all that apply.</p>}
          {question.options.map((o, i) => {
            const selected = value.selectedOptionIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={selected}
                onClick={() => {
                  const next = multi
                    ? selected
                      ? value.selectedOptionIds.filter((x) => x !== o.id)
                      : [...value.selectedOptionIds, o.id]
                    : [o.id];
                  onChange({ ...value, selectedOptionIds: next });
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-[15px] transition-all hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected && "border-brand bg-brand-soft/40 ring-1 ring-brand",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center border text-xs font-semibold text-muted-foreground transition-colors",
                    multi ? "rounded-md" : "rounded-full",
                    selected && "border-brand bg-brand text-brand-foreground",
                  )}
                >
                  {selected ? <Check className="size-3.5" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{o.text}</span>
              </button>
            );
          })}
        </div>
      );
    }
    case "SHORT_ANSWER":
    case "FILL_BLANK":
      return (
        <Input
          id={id}
          value={value.textAnswer}
          onChange={(e) => onChange({ ...value, textAnswer: e.target.value })}
          placeholder={question.type === "FILL_BLANK" ? "Fill in the missing word…" : "Type your answer…"}
          autoComplete="off"
          spellCheck={false}
          lang="de"
          className="h-12 text-base"
          aria-labelledby={`${id}-prompt`}
        />
      );
    case "ESSAY": {
      const words = value.textAnswer.trim() ? value.textAnswer.trim().split(/\s+/).length : 0;
      return (
        <div className="grid gap-1.5">
          <Textarea
            id={id}
            value={value.textAnswer}
            onChange={(e) => onChange({ ...value, textAnswer: e.target.value })}
            rows={10}
            lang="de"
            placeholder="Schreiben Sie Ihre Antwort hier…"
            className="text-base leading-relaxed"
            aria-labelledby={`${id}-prompt`}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{words} words · graded by your instructor</p>
        </div>
      );
    }
  }
}
