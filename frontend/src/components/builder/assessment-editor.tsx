"use client";

import * as React from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ClipboardList, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AssessmentDto, QuestionType } from "@/lib/api/types";
import { isApiError } from "@/lib/api/client";
import { QUESTION_TYPES, QUESTION_TYPE_META } from "@/lib/constants";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useAssessment, useSaveAssessment } from "@/hooks/queries/instructor";
import { useHotkey } from "@/hooks/use-hotkey";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { newKey, newQuestion, QuestionEditor, validateQuestion, type DraftQuestion } from "./question-editor";

interface Draft extends Omit<AssessmentDto, "questions"> {
  questions: DraftQuestion[];
}

function toDraft(dto: AssessmentDto): Draft {
  return {
    ...dto,
    questions: [...dto.questions]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        ...q,
        key: q.id ?? newKey(),
        acceptedAnswers: q.acceptedAnswers ?? [],
        options: [...(q.options ?? [])].sort((a, b) => a.position - b.position).map((o) => ({ ...o, key: o.id ?? newKey() })),
      })),
  };
}

function fromDraft(draft: Draft): AssessmentDto {
  return {
    itemId: draft.itemId,
    instructions: draft.instructions?.trim() ? draft.instructions : null,
    timeLimitMinutes: draft.timeLimitMinutes || null,
    maxAttempts: draft.maxAttempts || 0,
    passingScore: draft.passingScore,
    shuffleQuestions: draft.shuffleQuestions,
    showCorrectAnswers: draft.showCorrectAnswers,
    availableFrom: draft.availableFrom,
    availableUntil: draft.availableUntil,
    questions: draft.questions.map((q, position) => ({
      ...(q.id ? { id: q.id } : {}),
      type: q.type,
      prompt: q.prompt.trim(),
      explanation: q.explanation?.trim() ? q.explanation : null,
      points: q.points,
      position,
      caseSensitive: q.caseSensitive,
      acceptedAnswers: q.acceptedAnswers,
      mediaId: q.media?.id ?? q.mediaId ?? null,
      options: q.options.map((o, i) => ({ ...(o.id ? { id: o.id } : {}), text: o.text.trim(), correct: o.correct, position: i })),
    })),
  };
}

function AssessmentEditorInner({
  initial,
  itemId,
  courseId,
  active,
  onDirtyChange,
}: {
  initial: AssessmentDto;
  itemId: string;
  courseId: string;
  active: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = React.useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = React.useState<Draft>(saved);
  const baseline = React.useMemo(() => JSON.stringify(fromDraft(saved)), [saved]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(draft.questions.length <= 3 ? draft.questions.map((q) => q.key) : []));
  const [showErrors, setShowErrors] = React.useState(false);
  const save = useSaveAssessment(itemId, courseId);
  const t = useTranslations();
  const errorMessage = useErrorMessage();

  const payload = React.useMemo(() => fromDraft(draft), [draft]);
  const dirty = JSON.stringify(payload) !== baseline;
  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const errors = new Map(draft.questions.map((q) => [q.key, validateQuestion(q)] as const));
  const errorCount = [...errors.values()].filter(Boolean).length;
  const totalPoints = draft.questions.reduce((s, q) => s + (Number.isFinite(q.points) ? q.points : 0), 0);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setQuestion = (key: string, q: DraftQuestion) => setDraft((d) => ({ ...d, questions: d.questions.map((x) => (x.key === key ? q : x)) }));

  const addQuestion = (type: QuestionType) => {
    const q = newQuestion(type);
    setDraft((d) => ({ ...d, questions: [...d.questions, q] }));
    setExpanded((e) => new Set(e).add(q.key));
  };

  const submit = () => {
    if (draft.availableFrom && draft.availableUntil && draft.availableUntil <= draft.availableFrom) {
      toast.error(t("assessmentEditor.windowError"));
      return;
    }
    if (errorCount > 0) {
      setShowErrors(true);
      setExpanded(new Set([...errors.entries()].filter(([, e]) => e).map(([k]) => k)));
      toast.error(t("assessmentEditor.fixQuestions", { count: errorCount }));
      return;
    }
    save.mutate(payload, {
      onSuccess: (saved) => {
        const next = toDraft(saved);
        // Keep expansion state for questions that existed before (match by position).
        const keys = draft.questions.map((q) => q.key);
        setExpanded((e) => new Set(next.questions.filter((_, i) => e.has(keys[i])).map((q) => q.key)));
        setDraft(next);
        setSaved(next);
        setShowErrors(false);
        toast.success(t("assessmentEditor.saved"));
      },
      onError: (err) => {
        if (isApiError(err) && Object.keys(err.fieldErrors).length > 0) {
          toast.error(Object.values(err.fieldErrors).join("\n"));
        } else toast.error(errorMessage(err));
      },
    });
  };
  useHotkey(
    "mod+s",
    (e) => {
      e.preventDefault();
      submit();
    },
    { enabled: active },
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    if (!over || a.id === over.id) return;
    setDraft((d) => {
      const from = d.questions.findIndex((q) => q.key === a.id);
      const to = d.questions.findIndex((q) => q.key === over.id);
      return from < 0 || to < 0 ? d : { ...d, questions: arrayMove(d.questions, from, to) };
    });
  };

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Plus /> {t("assessmentEditor.addQuestion")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("assessmentEditor.questionType")}</DropdownMenuLabel>
        {QUESTION_TYPES.map((qt) => {
          const Icon = QUESTION_TYPE_META[qt].icon;
          return (
            <DropdownMenuItem key={qt} onSelect={() => addQuestion(qt)} className="items-start py-2">
              <Icon className="mt-0.5" />
              <span className="grid">
                <span className="font-medium">{t(`questionTypes.${qt}.label`)}</span>
                <span className="text-xs text-muted-foreground">{t(`questionTypes.${qt}.description`)}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("assessmentEditor.settings")}</CardTitle>
          <CardDescription>{t("assessmentEditor.settingsText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="instructions">{t("assessmentEditor.instructions")}</Label>
            <Textarea
              id="instructions"
              rows={3}
              value={draft.instructions ?? ""}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder={t("assessmentEditor.instructionsPlaceholder")}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="time-limit">{t("assessmentEditor.timeLimit")}</Label>
              <div className="relative">
                <Input
                  id="time-limit"
                  type="number"
                  min={0}
                  placeholder={t("assessmentEditor.noLimit")}
                  value={draft.timeLimitMinutes ?? ""}
                  onChange={(e) => set({ timeLimitMinutes: e.target.value ? Math.max(0, Number(e.target.value)) : null })}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{t("common.min")}</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max-attempts">{t("assessmentEditor.maxAttempts")}</Label>
              <Input
                id="max-attempts"
                type="number"
                min={0}
                value={draft.maxAttempts}
                onChange={(e) => set({ maxAttempts: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className="text-xs text-muted-foreground">{t("assessmentEditor.zeroUnlimited")}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>{t("assessmentEditor.passingScore")}</Label>
              <span className="text-sm font-semibold tabular-nums">{draft.passingScore}%</span>
            </div>
            <Slider value={[draft.passingScore]} min={0} max={100} step={5} onValueChange={([v]) => set({ passingScore: v })} aria-label={t("assessmentEditor.passingScore")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                <span className="block font-medium">{t("assessmentEditor.shuffle")}</span>
                <span className="text-xs text-muted-foreground">{t("assessmentEditor.shuffleText")}</span>
              </span>
              <Switch checked={draft.shuffleQuestions} onCheckedChange={(c) => set({ shuffleQuestions: c })} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                <span className="block font-medium">{t("assessmentEditor.showAnswers")}</span>
                <span className="text-xs text-muted-foreground">{t("assessmentEditor.showAnswersText")}</span>
              </span>
              <Switch checked={draft.showCorrectAnswers} onCheckedChange={(c) => set({ showCorrectAnswers: c })} />
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="available-from">{t("assessmentEditor.availableFrom")}</Label>
              <DateTimePicker id="available-from" value={draft.availableFrom} onChange={(v) => set({ availableFrom: v })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="available-until">{t("assessmentEditor.availableUntil")}</Label>
              <DateTimePicker id="available-until" value={draft.availableUntil} onChange={(v) => set({ availableUntil: v })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-label={t("assessmentEditor.questions")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t("assessmentEditor.questions")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("assessmentEditor.questionsCount", { count: draft.questions.length })} · {t("common.points", { count: totalPoints })}
            </p>
          </div>
          {draft.questions.length > 0 && addMenu}
        </div>
        {draft.questions.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("assessmentEditor.emptyTitle")} description={t("assessmentEditor.emptyText")} action={addMenu} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft.questions.map((q) => q.key)} strategy={verticalListSortingStrategy}>
              <ol className="grid gap-3">
                {draft.questions.map((q, i) => (
                  <QuestionEditor
                    key={q.key}
                    question={q}
                    index={i}
                    expanded={expanded.has(q.key)}
                    error={showErrors ? (errors.get(q.key) ?? null) : null}
                    onToggle={() =>
                      setExpanded((e) => {
                        const next = new Set(e);
                        if (next.has(q.key)) next.delete(q.key);
                        else next.add(q.key);
                        return next;
                      })
                    }
                    onChange={(nq) => setQuestion(q.key, nq)}
                    onDuplicate={() => {
                      const copy: DraftQuestion = {
                        ...q,
                        id: undefined,
                        key: newKey(),
                        options: q.options.map((o) => ({ ...o, id: undefined, key: newKey() })),
                      };
                      setDraft((d) => {
                        const qs = [...d.questions];
                        qs.splice(i + 1, 0, copy);
                        return { ...d, questions: qs };
                      });
                      setExpanded((e) => new Set(e).add(copy.key));
                    }}
                    onDelete={() => setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.key !== q.key) }))}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>

      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t bg-background/85 py-3 backdrop-blur">
        <span className="mr-auto text-xs text-muted-foreground">
          {dirty ? (
            <>
              {t("assessmentEditor.unsaved")} <Kbd>⌘/Ctrl</Kbd> <Kbd>S</Kbd>
            </>
          ) : (
            t("common.allSaved")
          )}
        </span>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(saved);
              setShowErrors(false);
            }}
          >
            {t("common.discard")}
          </Button>
        )}
        <Button onClick={submit} loading={save.isPending} disabled={!dirty}>
          <Save /> {t("assessmentEditor.save")}
        </Button>
      </div>
    </div>
  );
}

export function AssessmentEditor({
  itemId,
  courseId,
  active,
  onDirtyChange,
}: {
  itemId: string;
  courseId: string;
  active: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const assessment = useAssessment(itemId);
  if (assessment.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  if (assessment.isError) return <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />;
  return <AssessmentEditorInner initial={assessment.data} itemId={itemId} courseId={courseId} active={active} onDirtyChange={onDirtyChange} />;
}
