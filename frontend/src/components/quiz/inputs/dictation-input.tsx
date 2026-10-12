"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SessionQuestion } from "@/lib/api/types";
import type { DraftAnswer } from "@/lib/exercises";
import { Textarea } from "@/components/ui/textarea";

/** DICTATION: the audio is the question media above; the learner types what they hear. */
export function DictationInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  const t = useTranslations("exercises");
  return (
    <div className="grid gap-2">
      {question.media?.kind !== "AUDIO" && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /> {t("dictationNoAudio")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("dictationHint")}</p>
      <Textarea
        id={`q-${question.id}`}
        value={value.textAnswer}
        onChange={(e) => onChange({ ...value, textAnswer: e.target.value })}
        rows={3}
        lang="de"
        autoComplete="off"
        spellCheck={false}
        placeholder={t("dictationPlaceholder")}
        className="text-base leading-relaxed"
        aria-labelledby={`q-${question.id}-prompt`}
      />
    </div>
  );
}
