"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import type { SessionQuestion } from "@/lib/api/types";
import { blankIndexes, splitPrompt, type DraftAnswer } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { InlineHtml } from "@/components/course/rich-content";

/** CLOZE: the prompt with a text field at every numbered blank. */
export function ClozeInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  const t = useTranslations("exercises");
  const parts = React.useMemo(() => splitPrompt(question.prompt), [question.prompt]);
  const total = blankIndexes(question.prompt).length;
  const set = (index: number, text: string) => onChange({ ...value, blanks: { ...value.blanks, [String(index)]: text } });
  return (
    <div id={`q-${question.id}-prompt`} className="text-lg leading-[2.9rem] font-medium [&_p]:inline">
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <InlineHtml key={i} html={p.text} />
        ) : (
          <input
            key={i}
            value={value.blanks[String(p.index)] ?? ""}
            onChange={(e) => set(p.index, e.target.value)}
            aria-label={t("blankInline", { n: p.index, total })}
            lang="de"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ width: `${Math.max(7, (value.blanks[String(p.index)] ?? "").length + 3)}ch` }}
            className={cn(
              "mx-1 inline-block h-10 max-w-full min-w-24 rounded-md border-0 border-b-2 border-dashed border-brand/70 bg-brand-soft/30 px-2 text-center align-baseline text-base font-medium transition-colors outline-none",
              "placeholder:text-muted-foreground/60 focus-visible:border-solid focus-visible:bg-brand-soft/60 focus-visible:ring-2 focus-visible:ring-ring/30",
            )}
            placeholder={String(p.index)}
          />
        ),
      )}
    </div>
  );
}
