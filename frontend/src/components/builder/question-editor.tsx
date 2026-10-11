"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Copy, GripVertical, ImagePlus, LoaderCircle, Plus, Trash, X } from "lucide-react";
import { toast } from "sonner";
import type { MediaDto, QuestionDto, QuestionOptionDto, QuestionType } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { mediaApi } from "@/lib/api/media";
import { QUESTION_TYPES, QUESTION_TYPE_META } from "@/lib/constants";
import { cn, pluralize } from "@/lib/utils";
import { AudioPlayer } from "@/components/learn/audio-player";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagsInput } from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";

export interface DraftOption extends QuestionOptionDto {
  key: string;
}
export interface DraftQuestion extends Omit<QuestionDto, "options"> {
  key: string;
  options: DraftOption[];
}

let keyCounter = 0;
export const newKey = () => `k${Date.now().toString(36)}${(keyCounter += 1)}`;

const opt = (text: string, correct: boolean): DraftOption => ({ key: newKey(), text, correct, position: 0 });

export function defaultOptions(type: QuestionType): DraftOption[] {
  switch (type) {
    case "TRUE_FALSE":
      return [opt("Richtig", true), opt("Falsch", false)];
    case "SINGLE_CHOICE":
      return [opt("", true), opt("", false), opt("", false)];
    case "MULTIPLE_CHOICE":
      return [opt("", true), opt("", true), opt("", false), opt("", false)];
    default:
      return [];
  }
}

export function newQuestion(type: QuestionType): DraftQuestion {
  return {
    key: newKey(),
    type,
    prompt: "",
    explanation: null,
    points: type === "ESSAY" ? 5 : 1,
    position: 0,
    caseSensitive: false,
    acceptedAnswers: [],
    mediaId: null,
    media: null,
    options: defaultOptions(type),
  };
}

const isChoice = (t: QuestionType) => t === "SINGLE_CHOICE" || t === "MULTIPLE_CHOICE" || t === "TRUE_FALSE";

export function convertType(q: DraftQuestion, type: QuestionType): DraftQuestion {
  if (type === q.type) return q;
  let options = q.options;
  if (type === "TRUE_FALSE") options = defaultOptions("TRUE_FALSE");
  else if (isChoice(type)) {
    options = isChoice(q.type) && q.type !== "TRUE_FALSE" ? q.options : defaultOptions(type);
    if (type === "SINGLE_CHOICE") {
      const first = options.findIndex((o) => o.correct);
      options = options.map((o, i) => ({ ...o, correct: i === (first < 0 ? 0 : first) }));
    }
  } else options = [];
  return {
    ...q,
    type,
    options,
    acceptedAnswers: type === "SHORT_ANSWER" || type === "FILL_BLANK" ? q.acceptedAnswers : [],
    points: type === "ESSAY" && q.points < 2 ? 5 : q.points,
  };
}

export function validateQuestion(q: DraftQuestion): string | null {
  if (!q.prompt.trim()) return "Write the question prompt.";
  if (!(q.points > 0)) return "Points must be greater than 0.";
  if (isChoice(q.type)) {
    if (q.options.length < 2) return "Add at least two options.";
    if (q.options.some((o) => !o.text.trim())) return "Fill in every option or remove empty ones.";
    if (!q.options.some((o) => o.correct)) return "Mark at least one option as correct.";
  }
  if ((q.type === "SHORT_ANSWER" || q.type === "FILL_BLANK") && q.acceptedAnswers.length === 0) return "Add at least one accepted answer.";
  return null;
}

function MediaField({ media, onChange }: { media: MediaDto | null | undefined; onChange: (m: MediaDto | null) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const upload = async (file: File) => {
    setProgress(0);
    try {
      const m = await mediaApi.upload(file, { onProgress: setProgress });
      onChange(m);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="grid gap-2">
      {media ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-2">
          <div className="min-w-0 flex-1">
            {media.kind === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed media URL
              <img src={media.url} alt="" className="max-h-40 rounded-md border object-contain" />
            ) : media.kind === "AUDIO" ? (
              <AudioPlayer src={media.url} title={media.fileName} compact />
            ) : (
              <p className="truncate text-sm">{media.fileName}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(null)} aria-label="Remove question media">
            <X />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          {progress !== null ? `Uploading ${progress}%` : "Add audio or image"}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function QuestionEditor({
  question,
  index,
  expanded,
  error,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
}: {
  question: DraftQuestion;
  index: number;
  expanded: boolean;
  error: string | null;
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
  const Icon = QUESTION_TYPE_META[q.type].icon;
  const id = `q-${q.key}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-xl border bg-card shadow-xs", isDragging && "z-10 shadow-lg ring-2 ring-brand", error && !expanded && "border-destructive/40")}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
          aria-label={`Reorder question ${index + 1}`}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-medium", !q.prompt && "text-muted-foreground italic")}>{q.prompt || "New question"}</span>
            <span className="block text-xs text-muted-foreground">
              {QUESTION_TYPE_META[q.type].label} · {pluralize(q.points, "pt")}
              {error && <span className="text-destructive"> · {error}</span>}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
        </button>
        <Tooltip content="Duplicate">
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDuplicate} aria-label={`Duplicate question ${index + 1}`}>
            <Copy />
          </Button>
        </Tooltip>
        <Tooltip content="Delete">
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDelete} aria-label={`Delete question ${index + 1}`} className="hover:text-destructive">
            <Trash />
          </Button>
        </Tooltip>
      </div>

      {expanded && (
        <div className="grid gap-5 border-t p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_110px]">
            <div className="grid gap-2 sm:col-span-1">
              <Label htmlFor={`${id}-prompt`}>Prompt</Label>
              <Textarea
                id={`${id}-prompt`}
                rows={3}
                value={q.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                lang="de"
                placeholder={q.type === "FILL_BLANK" ? "Ich ___ jeden Morgen Kaffee. (Use ___ for the gap)" : "Was bedeutet „Feierabend“?"}
                aria-invalid={!!error && !q.prompt.trim()}
              />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-type`}>Type</Label>
              <Select value={q.type} onValueChange={(t) => onChange(convertType(q, t as QuestionType))}>
                <SelectTrigger id={`${id}-type`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {QUESTION_TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-points`}>Points</Label>
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

          <div className="grid gap-2">
            <Label>Media (listening or reading comprehension)</Label>
            <MediaField media={q.media} onChange={(m) => set({ media: m, mediaId: m?.id ?? null })} />
          </div>

          {isChoice(q.type) && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                Options{" "}
                <span className="font-normal text-muted-foreground">
                  ({q.type === "MULTIPLE_CHOICE" ? "check every correct answer" : "select the correct answer"})
                </span>
              </legend>
              {q.options.map((o, i) => (
                <div key={o.key} className="flex items-center gap-2">
                  {q.type === "MULTIPLE_CHOICE" ? (
                    <Checkbox checked={o.correct} onCheckedChange={() => markCorrect(o.key)} aria-label={`Option ${i + 1} is correct`} className="size-5" />
                  ) : (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={o.correct}
                      onClick={() => markCorrect(o.key)}
                      aria-label={`Option ${i + 1} is the correct answer`}
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
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    aria-label={`Option ${i + 1} text`}
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
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {q.type !== "TRUE_FALSE" && q.options.length < 10 && (
                <Button type="button" variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => set({ options: [...q.options, opt("", false)] })}>
                  <Plus /> Add option
                </Button>
              )}
            </fieldset>
          )}

          {(q.type === "SHORT_ANSWER" || q.type === "FILL_BLANK") && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-accepted`}>Accepted answers</Label>
                <TagsInput id={`${id}-accepted`} value={q.acceptedAnswers} onChange={(v) => set({ acceptedAnswers: v })} placeholder="trinke, trink…" />
                <p className="text-xs text-muted-foreground">Any of these answers counts as correct. Leading/trailing spaces are ignored.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={q.caseSensitive} onCheckedChange={(c) => set({ caseSensitive: c })} />
                Case-sensitive (e.g. nouns must be capitalised)
              </label>
            </div>
          )}

          {q.type === "ESSAY" && (
            <p className="rounded-lg border border-info/25 bg-info-soft/50 px-3 py-2 text-[13px] text-info">
              Essay answers are graded manually in the Submissions tab. Learners see “awaiting grading” until you score them.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${id}-explanation`}>
              Explanation <span className="font-normal text-muted-foreground">(shown with the results, optional)</span>
            </Label>
            <Textarea
              id={`${id}-explanation`}
              rows={2}
              value={q.explanation ?? ""}
              onChange={(e) => set({ explanation: e.target.value || null })}
              lang="de"
            />
          </div>
        </div>
      )}
    </li>
  );
}
