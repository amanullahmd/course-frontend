"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, Copy, GripVertical, Plus, Trash, X } from "lucide-react";
import type { QuestionType } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { QUESTION_TYPES, QUESTION_TYPE_META } from "@/lib/constants";
import { cn, stripHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagsInput } from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { BlankPrompt } from "./question-editors/blank-prompt";
import { ClozeEditor } from "./question-editors/cloze-editor";
import { DictationEditor } from "./question-editors/dictation-editor";
import { MatchingEditor } from "./question-editors/matching-editor";
import { MediaField } from "./question-editors/media-field";
import { OrderingEditor } from "./question-editors/ordering-editor";
import { QuestionPreview } from "./question-editors/preview";
import { ScoringFields } from "./question-editors/scoring-fields";
import { SpeakingEditor } from "./question-editors/speaking-editor";
import { WordBankEditor } from "./question-editors/word-bank-editor";
import {
  convertType,
  errorMessageKey,
  hasBlanks,
  isChoice,
  newKey,
  isTextType,
  type DraftOption,
  type DraftQuestion,
  type QuestionError,
} from "./question-model";

export {
  convertType,
  defaultOptions,
  newKey,
  newQuestion,
  validateQuestion,
  type DraftOption,
  type DraftQuestion,
  type QuestionError,
} from "./question-model";

export function QuestionEditor({
  question,
  index,
  expanded,
  error,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
  serverErrors = [],
}: {
  question: DraftQuestion;
  index: number;
  expanded: boolean;
  error: QuestionError | null;
  serverErrors?: string[];
  onToggle: () => void;
  onChange: (q: DraftQuestion) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.key });
  const q = question;
  const set = (patch: Partial<DraftQuestion>) => onChange({ ...q, ...patch });
  const setOption = (key: string, patch: Partial<DraftOption>) => set({ options: q.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const markCorrect = (key: string) =>
    set({
      options: q.options.map((o) =>
        q.type === "MULTIPLE_CHOICE" ? (o.key === key ? { ...o, correct: !o.correct } : o) : { ...o, correct: o.key === key },
      ),
    });
  const t = useTranslations();
  const Icon = QUESTION_TYPE_META[q.type].icon;
  const id = `q-${q.key}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-xl border bg-card shadow-xs", isDragging && "z-10 shadow-lg ring-2 ring-brand", (error || serverErrors.length > 0) && !expanded && "border-destructive/40")}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
          aria-label={t("question.reorder", { n: index + 1 })}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-medium", !q.prompt && "text-muted-foreground italic")}>{stripHtml(q.prompt) || t("question.newQuestion")}</span>
            <span className="block text-xs text-muted-foreground">
              {t(`questionTypes.${q.type}.label`)} · {t("common.points", { count: Number.isFinite(q.points) ? q.points : 0 })}
              {error && <span className="text-destructive"> · {t(errorMessageKey(error) as never)}</span>}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
        </button>
        <Tooltip content={t("question.duplicate")}>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDuplicate} aria-label={t("question.duplicateN", { n: index + 1 })}>
            <Copy />
          </Button>
        </Tooltip>
        <Tooltip content={t("common.delete")}>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDelete} aria-label={t("question.deleteN", { n: index + 1 })} className="hover:text-destructive">
            <Trash />
          </Button>
        </Tooltip>
      </div>

      {expanded && (
        <div className="grid gap-5 border-t p-4 sm:p-5">
          {serverErrors.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft/60 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{t("exercises.editor.serverErrors")}</p>
                <ul className="list-disc pl-4">
                  {serverErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
            {hasBlanks(q.type) ? (
              <BlankPrompt q={q} set={set} id={id} invalid={!!error && !q.prompt.trim()} />
            ) : (
              <div className="grid gap-2 sm:col-span-1">
                <Label htmlFor={`${id}-prompt`}>{t("question.prompt")}</Label>
                <Textarea
                  id={`${id}-prompt`}
                  rows={3}
                  value={q.prompt}
                  onChange={(e) => set({ prompt: e.target.value })}
                  lang="de"
                  placeholder={promptPlaceholder(q.type, t as unknown as Translate)}
                  aria-invalid={!!error && !q.prompt.trim()}
                />
              </div>
            )}
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-type`}>{t("question.type")}</Label>
              <Select value={q.type} onValueChange={(t) => onChange(convertType(q, t as QuestionType))}>
                <SelectTrigger id={`${id}-type`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((qt) => (
                    <SelectItem key={qt} value={qt}>
                      {t(`questionTypes.${qt}.label`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-points`}>{t("question.points")}</Label>
              <Input
                id={`${id}-points`}
                type="number"
                min={0.5}
                step={0.5}
                value={Number.isFinite(q.points) ? q.points : ""}
                onChange={(e) => set({ points: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
              />
            </div>
          </div>

          {q.type !== "DICTATION" && (
            <div className="grid gap-2">
              <Label>{t("question.media")}</Label>
              <MediaField media={q.media} onChange={(m) => set({ media: m, mediaId: m?.id ?? null })} />
            </div>
          )}

          {isChoice(q.type) && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                {t("question.options")}{" "}
                <span className="font-normal text-muted-foreground">
                  {q.type === "MULTIPLE_CHOICE" ? t("question.optionsMulti") : t("question.optionsSingle")}
                </span>
              </legend>
              {q.options.map((o, i) => (
                <div key={o.key} className="flex items-center gap-2">
                  {q.type === "MULTIPLE_CHOICE" ? (
                    <Checkbox checked={o.correct} onCheckedChange={() => markCorrect(o.key)} aria-label={t("question.optionCorrect", { n: i + 1 })} className="size-5" />
                  ) : (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={o.correct}
                      onClick={() => markCorrect(o.key)}
                      aria-label={t("question.optionTheCorrect", { n: i + 1 })}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        o.correct ? "border-success" : "border-input hover:border-foreground/40",
                      )}
                    >
                      {o.correct && <span className="size-2.5 rounded-full bg-success" />}
                    </button>
                  )}
                  <Input
                    value={o.text}
                    onChange={(e) => setOption(o.key, { text: e.target.value })}
                    placeholder={t("question.option", { letter: String.fromCharCode(65 + i) })}
                    aria-label={t("question.optionText", { n: i + 1 })}
                    lang="de"
                    className={cn(o.correct && "border-success/50 bg-success-soft/30")}
                    readOnly={q.type === "TRUE_FALSE" ? false : undefined}
                  />
                  {q.type !== "TRUE_FALSE" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => set({ options: q.options.filter((x) => x.key !== o.key) })}
                      disabled={q.options.length <= 2}
                      aria-label={t("question.removeOption", { n: i + 1 })}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {q.type !== "TRUE_FALSE" && q.options.length < 10 && (
                <Button type="button" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => set({ options: [...q.options, opt("", false)] })}>
                  <Plus /> {t("question.addOption")}
                </Button>
              )}
            </fieldset>
          )}

          {q.type === "CLOZE" && <ClozeEditor q={q} set={set} id={id} />}
          {q.type === "WORD_BANK" && <WordBankEditor q={q} set={set} />}
          {q.type === "MATCHING" && <MatchingEditor q={q} set={set} />}
          {q.type === "ORDERING" && <OrderingEditor q={q} set={set} />}
          {q.type === "DICTATION" && <DictationEditor q={q} set={set} id={id} showErrors={!!error} />}
          {q.type === "SPEAKING" && <SpeakingEditor q={q} set={set} id={id} />}

          {isTextType(q.type) && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-accepted`}>{t("question.accepted")}</Label>
                <TagsInput id={`${id}-accepted`} value={q.acceptedAnswers} onChange={(v) => set({ acceptedAnswers: v })} placeholder={t("question.acceptedPlaceholder")} />
                <p className="text-xs text-muted-foreground">{t("question.acceptedHint")}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={q.caseSensitive} onCheckedChange={(c) => set({ caseSensitive: c })} />
                {t("question.caseSensitive")}
              </label>
            </div>
          )}

          {q.type === "ESSAY" && (
            <p className="rounded-lg border border-info/25 bg-info-soft/50 px-3 py-2 text-[13px] text-info">
              {t("question.essayNote")}
            </p>
          )}

          <ScoringFields q={q} set={set} />

          <div className="grid gap-2">
            <Label htmlFor={`${id}-explanation`}>
              {t("question.explanation")} <span className="font-normal text-muted-foreground">{t("question.explanationHint")}</span>
            </Label>
            <Textarea
              id={`${id}-explanation`}
              rows={2}
              value={q.explanation ?? ""}
              onChange={(e) => set({ explanation: e.target.value || null })}
              lang="de"
            />
          </div>

          <QuestionPreview key={q.type} q={q} />
        </div>
      )}
    </li>
  );
}

type Translate = (key: string, values?: Record<string, string>) => string;

function promptPlaceholder(type: QuestionType, t: Translate): string {
  switch (type) {
    case "FILL_BLANK":
      return t("question.promptFill");
    case "MATCHING":
      return t("exercises.editor.promptMatching");
    case "ORDERING":
      return t("exercises.editor.promptOrdering");
    case "DICTATION":
      return t("exercises.editor.promptDictation");
    case "SPEAKING":
      return t("exercises.editor.promptSpeaking");
    default:
      return t("question.promptDefault");
  }
}

const opt = (text: string, correct: boolean): DraftOption => ({ key: newKey(), text, correct, position: 0 });
