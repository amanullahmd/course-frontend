"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { TagsInput } from "@/components/ui/tags-input";
import type { DraftQuestion } from "../question-model";
import { MediaField } from "./media-field";

/** DICTATION: the audio to listen to plus the reference sentence(s). */
export function DictationEditor({ q, set, id, showErrors }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void; id: string; showErrors: boolean }) {
  const t = useTranslations("exercises.editor");
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>{t("dictationAudio")}</Label>
        <MediaField audioOnly invalid={showErrors && q.media?.kind !== "AUDIO"} media={q.media} onChange={(m) => set({ media: m, mediaId: m?.id ?? null })} />
        <p className="text-xs text-muted-foreground">{t("dictationAudioHint")}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-reference`}>{t("dictationReference")}</Label>
        <TagsInput id={`${id}-reference`} value={q.acceptedAnswers} onChange={(v) => set({ acceptedAnswers: v })} placeholder={t("dictationPlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("dictationReferenceHint")}</p>
      </div>
    </div>
  );
}
