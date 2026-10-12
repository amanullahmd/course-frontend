"use client";

import * as React from "react";
import { TextCursorInput } from "lucide-react";
import { useTranslations } from "next-intl";
import { insertBlank } from "@/lib/exercises";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setBlankAnswers, type DraftOption, type DraftQuestion, newKey } from "../question-model";

/** Prompt of a CLOZE / WORD_BANK question: select a word, press "Make blank", it becomes {{n}}. */
export function BlankPrompt({
  q,
  set,
  id,
  invalid,
}: {
  q: DraftQuestion;
  set: (patch: Partial<DraftQuestion>) => void;
  id: string;
  invalid: boolean;
}) {
  const t = useTranslations("exercises.editor");
  const tq = useTranslations("question");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const makeBlank = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? q.prompt.length;
    const end = el?.selectionEnd ?? q.prompt.length;
    const r = insertBlank(q.prompt, start, end);
    if (q.type === "CLOZE") {
      set({ prompt: r.prompt, blanks: setBlankAnswers(q.blanks, r.index, r.selected ? [r.selected] : []) });
    } else {
      const chip: DraftOption = { key: newKey(), text: r.selected, correct: true, position: q.options.length, blankIndex: r.index };
      set({ prompt: r.prompt, options: [...q.options, chip] });
    }
    const caret = r.prompt.indexOf(`{{${r.index}}}`) + `{{${r.index}}}`.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-prompt`}>{tq("prompt")}</Label>
      <Textarea
        ref={ref}
        id={`${id}-prompt`}
        rows={3}
        value={q.prompt}
        onChange={(e) => set({ prompt: e.target.value })}
        lang="de"
        placeholder={t(q.type === "CLOZE" ? "promptCloze" : "promptWordBank", { m1: "{{1}}", m2: "{{2}}" })}
        aria-invalid={invalid}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={makeBlank}>
          <TextCursorInput /> {t("makeBlank")}
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("makeBlankHint", { marker: "{{1}}" })}</p>
      </div>
    </div>
  );
}
