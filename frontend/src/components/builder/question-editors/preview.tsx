"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { emptyAnswer, type DraftAnswer } from "@/lib/exercises";
import { Button } from "@/components/ui/button";
import { QuestionInput, QuestionMedia, QuestionPrompt } from "@/components/quiz/question-input";
import { toPreviewQuestion, type DraftQuestion } from "../question-model";

/** Shows the question exactly as learners get it; answers entered here are thrown away. */
export function QuestionPreview({ q }: { q: DraftQuestion }) {
  const t = useTranslations("exercises.editor");
  const [open, setOpen] = React.useState(false);
  const [answer, setAnswer] = React.useState<DraftAnswer>(emptyAnswer);
  const question = React.useMemo(() => toPreviewQuestion(q), [q]);
  return (
    <div className="grid gap-3">
      <Button type="button" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <EyeOff /> : <Eye />} {open ? t("preview") : t("previewToggle")}
      </Button>
      {open && (
        <div className="grid gap-4 rounded-xl border border-dashed bg-background p-4 sm:p-5" aria-label={t("preview")} role="group">
          <p className="text-xs text-muted-foreground">{t("previewHint")}</p>
          <div id={`q-${question.id}-prompt`}>{q.prompt.trim() ? <QuestionPrompt prompt={q.prompt} type={q.type} /> : null}</div>
          <QuestionMedia media={question.media} />
          <QuestionInput question={question} value={answer} onChange={setAnswer} />
        </div>
      )}
    </div>
  );
}
