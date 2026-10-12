"use client";

import { ArrowRight, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newKey, type DraftOption, type DraftQuestion } from "../question-model";

/** Two-column pair list of a MATCHING question. */
export function MatchingEditor({ q, set }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void }) {
  const t = useTranslations("exercises.editor");
  const update = (key: string, patch: Partial<DraftOption>) => set({ options: q.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t("pairs")}</legend>
      <p className="mb-1 text-xs text-muted-foreground">{t("pairsHint")}</p>
      <div className="hidden grid-cols-[1fr_1.25rem_1fr_1.75rem] gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid">
        <span>{t("leftSide")}</span>
        <span />
        <span>{t("rightSide")}</span>
      </div>
      {q.options.map((o, i) => (
        <div key={o.key} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_1.25rem_1fr_1.75rem]">
          <Input value={o.text} onChange={(e) => update(o.key, { text: e.target.value })} aria-label={t("leftN", { n: i + 1 })} placeholder={t("leftN", { n: i + 1 })} lang="de" />
          <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
          <Input
            value={o.matchText ?? ""}
            onChange={(e) => update(o.key, { matchText: e.target.value })}
            aria-label={t("rightN", { n: i + 1 })}
            placeholder={t("rightN", { n: i + 1 })}
            lang="de"
            className="order-3 col-span-1 sm:order-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => set({ options: q.options.filter((x) => x.key !== o.key) })}
            disabled={q.options.length <= 2}
            aria-label={t("removePair", { n: i + 1 })}
            className="order-2 sm:order-none"
          >
            <X />
          </Button>
        </div>
      ))}
      {q.options.length < 12 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() => set({ options: [...q.options, { key: newKey(), text: "", matchText: "", correct: false, position: q.options.length }] })}
        >
          <Plus /> {t("addPair")}
        </Button>
      )}
    </fieldset>
  );
}
