"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { supportsLenient, supportsPartial, supportsShuffle, type DraftQuestion } from "../question-model";

const PARTIAL_HINT: Partial<Record<DraftQuestion["type"], string>> = {
  MULTIPLE_CHOICE: "partialCreditMultiple",
  CLOZE: "partialCreditBlanks",
  WORD_BANK: "partialCreditBlanks",
  MATCHING: "partialCreditMatching",
  ORDERING: "partialCreditOrdering",
  DICTATION: "partialCreditDictation",
};

/** Partial credit, option shuffle and spelling tolerance, shown for the types they apply to. */
export function ScoringFields({ q, set }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void }) {
  const t = useTranslations("exercises.editor");
  const partial = supportsPartial(q.type);
  const shuffle = supportsShuffle(q.type);
  const lenient = supportsLenient(q.type);
  if (!partial && !shuffle && !lenient) return null;
  return (
    <fieldset className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <legend className="px-1 text-sm font-medium">{t("scoring")}</legend>
      {partial && (
        <label className="flex items-start gap-3 text-sm">
          <Switch className="mt-0.5" checked={q.scoring === "PARTIAL"} onCheckedChange={(c) => set({ scoring: c ? "PARTIAL" : "ALL_OR_NOTHING" })} />
          <span>
            <span className="font-medium">{t("partialCredit")}</span>
            <span className="block text-xs text-muted-foreground">{q.scoring === "PARTIAL" ? t((PARTIAL_HINT[q.type] ?? "partialCreditBlanks") as never) : t("allOrNothing")}</span>
          </span>
        </label>
      )}
      {shuffle && (
        <label className="flex items-start gap-3 text-sm">
          <Switch className="mt-0.5" checked={!!q.shuffleOptions} onCheckedChange={(c) => set({ shuffleOptions: c })} />
          <span>
            <span className="font-medium">{t("shuffle")}</span>
            {(q.type === "MATCHING") && <span className="block text-xs text-muted-foreground">{t("shuffleHint")}</span>}
          </span>
        </label>
      )}
      {lenient && (
        <label className="flex items-start gap-3 text-sm">
          <Switch className="mt-0.5" checked={!!q.lenientSpelling} onCheckedChange={(c) => set({ lenientSpelling: c })} />
          <span>
            <span className="font-medium">{t("lenient")}</span>
            <span className="block text-xs text-muted-foreground">{t("lenientHint")}</span>
          </span>
        </label>
      )}
    </fieldset>
  );
}
