"use client";

import { ArrowRight, Check, CircleCheck, CircleX, Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AttemptAnswerResult } from "@/lib/api/types";
import { splitPrompt } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { InlineHtml } from "@/components/course/rich-content";
import { AudioPlayer } from "@/components/learn/audio-player";

/** Types whose review is more than "your text" / options. */
export const isLanguageType = (type: AttemptAnswerResult["type"]) =>
  type === "CLOZE" || type === "WORD_BANK" || type === "MATCHING" || type === "ORDERING" || type === "DICTATION" || type === "SPEAKING";

/** The question text; for blank types the prompt with each blank filled in and colored. */
export function AnswerPrompt({ answer }: { answer: AttemptAnswerResult }) {
  const t = useTranslations("exercises.review");
  if (answer.type !== "CLOZE" && answer.type !== "WORD_BANK") return <InlineHtml html={answer.prompt} />;
  const results = new Map((answer.blankResults ?? []).map((r) => [r.index, r]));
  return (
    <span className="leading-[2.4]">
      {splitPrompt(answer.prompt).map((p, i) => {
        if (p.kind === "text") return <InlineHtml key={i} html={p.text} />;
        const r = results.get(p.index);
        const filled = !!r?.given;
        return (
          <span key={i} className="mx-0.5 inline-flex flex-wrap items-baseline gap-x-1.5 align-baseline">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[15px]",
                !filled && "border-dashed text-muted-foreground",
                r?.correct && "border-success/40 bg-success-soft/60 text-success",
                filled && r && !r.correct && "border-destructive/40 bg-destructive-soft/60 text-destructive line-through decoration-destructive/50",
              )}
              aria-label={`${t("blankResult", { n: p.index })}: ${r?.given ?? t("empty")}`}
            >
              {r?.correct ? <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden /> : null}
              {r?.given ?? <em className="not-italic">{t("empty")}</em>}
            </span>
            {r && !r.correct && r.expected && r.expected.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success-soft/60 px-2 py-0.5 text-[13px] text-success">
                <ArrowRight className="size-3" aria-hidden /> {r.expected.join(" / ")}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** The learner's response to a language question, marked per blank / pair / position. */
export function AnswerDetail({ answer }: { answer: AttemptAnswerResult }) {
  const t = useTranslations("exercises.review");
  switch (answer.type) {
    case "MATCHING":
      return (
        <ul className="mt-4 grid gap-1.5">
          {(answer.pairResults ?? []).map((p) => (
            <li
              key={p.leftId}
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-sm",
                p.correct ? "border-success/40 bg-success-soft/50" : "border-destructive/40 bg-destructive-soft/50",
              )}
            >
              <span className="font-medium">{p.left}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              <span className={cn(!p.right && "text-muted-foreground italic")}>{p.right ?? t("notPlaced")}</span>
              {p.correct ? (
                <CircleCheck className="ml-auto size-4 text-success" aria-label={t("blankResult", { n: 1 })} />
              ) : (
                <>
                  {p.expectedRight && <span className="text-xs text-muted-foreground">{t("expectedPair", { right: p.expectedRight })}</span>}
                  <CircleX className="ml-auto size-4 text-destructive" aria-hidden />
                </>
              )}
            </li>
          ))}
        </ul>
      );
    case "ORDERING": {
      const text = new Map((answer.options ?? []).map((o) => [o.id, o.text]));
      const given = answer.order ?? [];
      const correct = answer.correctOrder ?? null;
      return (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{t("yourOrder")}</p>
            {given.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t("notPlaced")}</p>
            ) : (
              <ol className="grid gap-1.5">
                {given.map((id, i) => {
                  const ok = correct ? correct[i] === id : null;
                  return (
                    <li
                      key={id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                        ok === true && "border-success/40 bg-success-soft/50",
                        ok === false && "border-destructive/40 bg-destructive-soft/50",
                      )}
                    >
                      <span className="grid size-5 place-items-center rounded bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                      {text.get(id) ?? "…"}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          {correct && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t("correctOrder")}</p>
              <ol className="grid gap-1.5">
                {correct.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/30 px-3 py-1.5 text-sm">
                    <span className="grid size-5 place-items-center rounded bg-success-soft text-xs font-semibold text-success tabular-nums">{i + 1}</span>
                    {text.get(id) ?? "…"}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      );
    }
    case "DICTATION":
      return (
        <div className="mt-4 grid gap-2 text-sm">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="whitespace-pre-line">{answer.textAnswer?.trim() || <em className="text-muted-foreground">{t("empty")}</em>}</p>
          </div>
          {answer.acceptedAnswers && answer.acceptedAnswers.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success-soft/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">{t("reference")}</p>
              <p className="mt-0.5 font-medium">{answer.acceptedAnswers.join(" · ")}</p>
            </div>
          )}
        </div>
      );
    case "SPEAKING":
      return (
        <div className="mt-4 grid gap-2">
          {answer.responseMedia ? (
            <>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mic className="size-3.5" /> {t("yourRecording")}
              </p>
              <AudioPlayer src={answer.responseMedia.url} title={t("yourRecording")} compact />
              {answer.pointsAwarded == null && <p className="text-xs text-muted-foreground">{t("waitingForGrade")}</p>}
            </>
          ) : (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground italic">{t("noRecording")}</p>
          )}
        </div>
      );
    default:
      return null;
  }
}
