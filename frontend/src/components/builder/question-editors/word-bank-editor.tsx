"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { blankIndexes } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, inputClass } from "@/components/ui/input";
import { newKey, type DraftOption, type DraftQuestion } from "../question-model";

/** Chips of a WORD_BANK question: each correct chip belongs to one blank, the others are distractors. */
export function WordBankEditor({ q, set }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void }) {
  const t = useTranslations("exercises.editor");
  const markers = blankIndexes(q.prompt);
  const update = (key: string, patch: Partial<DraftOption>) =>
    set({ options: q.options.map((o) => (o.key === key ? { ...o, ...patch, correct: (patch.blankIndex !== undefined ? patch.blankIndex : o.blankIndex) != null } : o)) });
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{t("chips")}</legend>
      {q.options.map((o, i) => (
        <div key={o.key} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <Input
            value={o.text}
            onChange={(e) => update(o.key, { text: e.target.value })}
            aria-label={t("chipText", { n: i + 1 })}
            placeholder={t("chipText", { n: i + 1 })}
            lang="de"
            className={cn(o.blankIndex != null && "border-success/50 bg-success-soft/30")}
          />
          <select
            value={o.blankIndex ?? ""}
            onChange={(e) => update(o.key, { blankIndex: e.target.value === "" ? null : Number(e.target.value) })}
            aria-label={`${t("chipBlank")} (${t("chipText", { n: i + 1 })})`}
            className={cn(inputClass, "order-3 col-span-2 cursor-pointer sm:order-none sm:col-span-1")}
          >
            <option value="">{t("chipDistractor")}</option>
            {markers.map((n) => (
              <option key={n} value={n} disabled={q.options.some((x) => x.key !== o.key && x.blankIndex === n)}>
                {t("chipFor", { n })}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => set({ options: q.options.filter((x) => x.key !== o.key) })}
            aria-label={t("removeChip", { n: i + 1 })}
          >
            <X />
          </Button>
        </div>
      ))}
      {q.options.length < 20 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() => set({ options: [...q.options, { key: newKey(), text: "", correct: false, position: q.options.length, blankIndex: null }] })}
        >
          <Plus /> {t("addChip")}
        </Button>
      )}
    </fieldset>
  );
}
