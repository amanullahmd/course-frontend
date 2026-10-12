"use client";

import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS, type DraftQuestion } from "../question-model";

/** SPEAKING: how long the learner may record. */
export function SpeakingEditor({ q, set, id }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void; id: string }) {
  const t = useTranslations("exercises.editor");
  return (
    <div className="grid gap-3">
      <div className="grid max-w-56 gap-2">
        <Label htmlFor={`${id}-seconds`}>{t("speakingMax")}</Label>
        <Input
          id={`${id}-seconds`}
          type="number"
          min={MIN_RECORDING_SECONDS}
          max={MAX_RECORDING_SECONDS}
          step={5}
          value={q.maxRecordingSeconds ?? ""}
          onChange={(e) => set({ maxRecordingSeconds: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </div>
      <p className="flex items-start gap-2 rounded-lg border border-info/25 bg-info-soft/50 px-3 py-2 text-[13px] text-info">
        <Mic className="mt-0.5 size-4 shrink-0" /> {t("speakingHint")}
      </p>
    </div>
  );
}
