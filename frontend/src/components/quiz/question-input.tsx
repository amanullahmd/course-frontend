"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { SessionQuestion } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/learn/audio-player";
import { InlineHtml } from "@/components/course/rich-content";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DraftAnswer } from "@/lib/exercises";
import { ClozeInput } from "./inputs/cloze-input";
import { DictationInput } from "./inputs/dictation-input";
import { MatchingInput } from "./inputs/matching-input";
import { OrderingInput } from "./inputs/ordering-input";
import { SpeakingInput } from "./inputs/speaking-input";
import { WordBankInput } from "./inputs/word-bank-input";

export { emptyAnswer, isAnswered, type DraftAnswer } from "@/lib/exercises";

export function QuestionMedia({ media }: { media: SessionQuestion["media"] }) {
  const t = useTranslations();
  if (!media) return null;
  if (media.kind === "AUDIO") return <AudioPlayer src={media.url} title={t("audio.listen")} compact />;
  if (media.kind === "IMAGE")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed media URL
      <img src={media.url} alt={t("quiz.illustration")} className="max-h-80 w-auto rounded-xl border object-contain" />
    );
  if (media.kind === "VIDEO") return <video src={media.url} controls className="aspect-video w-full rounded-xl border bg-black" />;
  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
      {t("quiz.openAttached", { name: media.fileName })}
    </a>
  );
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Renders the (server-sanitised) prompt HTML; "___" gaps in fill-in-the-blank prompts become a highlighted blank
 * inside the same HTML, so inline formatting around the gap is kept.
 */
export function QuestionPrompt({ prompt, type }: { prompt: string; type: SessionQuestion["type"] }) {
  const t = useTranslations("quiz");
  // cloze and word bank render the prompt themselves, with the blanks inline
  if (type === "CLOZE" || type === "WORD_BANK") return null;
  if (type !== "FILL_BLANK" || !/_{3,}/.test(prompt)) {
    return (
      <p className="text-lg leading-relaxed font-medium">
        <InlineHtml html={prompt} />
      </p>
    );
  }
  const html = /<\/?[a-z][\s\S]*>/i.test(prompt) ? prompt : escapeHtml(prompt);
  const blank = `<span role="img" aria-label="${escapeHtml(t("blank"))}" class="mx-1 inline-block min-w-16 border-b-2 border-dashed border-brand align-baseline"></span>`;
  return (
    <div
      className="text-lg leading-relaxed font-medium whitespace-pre-line [&_p]:inline [&_strong]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html.replace(/_{3,}/g, blank) }}
    />
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
  const t = useTranslations("quiz");
  const id = `q-${question.id}`;
  switch (question.type) {
    case "SINGLE_CHOICE":
    case "TRUE_FALSE":
    case "MULTIPLE_CHOICE": {
      const multi = question.type === "MULTIPLE_CHOICE";
      return (
        <div role={multi ? "group" : "radiogroup"} aria-labelledby={`${id}-prompt`} className="grid gap-2.5">
          {multi && <p className="text-xs text-muted-foreground">{t("selectAll")}</p>}
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
          placeholder={question.type === "FILL_BLANK" ? t("fillPlaceholder") : t("answerPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          lang="de"
          className="h-12 text-base"
          aria-labelledby={`${id}-prompt`}
        />
      );
    case "CLOZE":
      return <ClozeInput question={question} value={value} onChange={onChange} />;
    case "WORD_BANK":
      return <WordBankInput question={question} value={value} onChange={onChange} />;
    case "MATCHING":
      return <MatchingInput question={question} value={value} onChange={onChange} />;
    case "ORDERING":
      return <OrderingInput question={question} value={value} onChange={onChange} />;
    case "DICTATION":
      return <DictationInput question={question} value={value} onChange={onChange} />;
    case "SPEAKING":
      return <SpeakingInput question={question} value={value} onChange={onChange} />;
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
            placeholder={t("essayPlaceholder")}
            className="text-base leading-relaxed"
            aria-labelledby={`${id}-prompt`}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{t("words", { count: words })}</p>
        </div>
      );
    }
  }
}
