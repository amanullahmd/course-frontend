"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { blankIndexes, removeBlank } from "@/lib/exercises";
import { Button } from "@/components/ui/button";
import { TagsInput } from "@/components/ui/tags-input";
import { blankAnswers, setBlankAnswers, type DraftQuestion } from "../question-model";

/** Accepted answers for each numbered blank of a CLOZE question. */
export function ClozeEditor({ q, set, id }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void; id: string }) {
  const t = useTranslations("exercises.editor");
  const markers = blankIndexes(q.prompt);
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">{t("blanksTitle")}</legend>
      {markers.length === 0 && <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">{t("noBlanksYet")}</p>}
      {markers.map((n) => {
        const answers = blankAnswers(q, n);
        return (
          <div key={n} className="grid gap-1.5 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${id}-blank-${n}`} className="text-sm font-medium">
                <span className="mr-2 inline-grid size-6 place-items-center rounded-md bg-brand-soft text-xs font-semibold text-brand-strong tabular-nums">{n}</span>
                {t("blankAccepted", { n })}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("removeBlank", { n })}
                onClick={() => set({ prompt: removeBlank(q.prompt, n, answers[0] ?? ""), blanks: (q.blanks ?? []).filter((b) => b.index !== n) })}
              >
                <X />
              </Button>
            </div>
            <TagsInput
              id={`${id}-blank-${n}`}
              value={answers}
              onChange={(v) => set({ blanks: setBlankAnswers(q.blanks, n, v) })}
              placeholder={t("blankPlaceholder")}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
