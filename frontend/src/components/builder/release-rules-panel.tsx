"use client";

import * as React from "react";
import { addDays } from "date-fns";
import { CalendarClock, Lock, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import type { ContentItemDto, CourseDto, ItemType, ModuleDto, PrerequisiteDto, ReleaseRulesRequest } from "@/lib/api/types";
import { isAssessmentType } from "@/lib/constants";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useInstructorCourse, useSetItemRelease, useSetModuleRelease } from "@/hooks/queries/instructor";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Badges shown in the builder (item rows and module cards)
// ---------------------------------------------------------------------------
export function ReleaseBadges({
  required,
  offsetDays,
  prerequisites,
  className,
}: {
  /** Pass `undefined` for modules (they have no required flag). */
  required?: boolean;
  offsetDays: number | null;
  prerequisites: PrerequisiteDto[];
  className?: string;
}) {
  const t = useTranslations("release");
  const list = prerequisites
    .map((p) => (p.minPercent != null ? `${p.title} (${t("minScore", { percent: p.minPercent })})` : p.title))
    .join(", ");
  return (
    <>
      {required === false && (
        <Badge variant="secondary" className={cn("px-1.5 py-0", className)}>
          {t("optional")}
        </Badge>
      )}
      {offsetDays != null && (
        <Badge variant="info" className={cn("px-1.5 py-0", className)} title={t("opensAfterDays", { days: offsetDays })}>
          <CalendarClock aria-hidden /> {t("dayBadge", { days: offsetDays })}
          <span className="sr-only">{t("opensAfterDays", { days: offsetDays })}</span>
        </Badge>
      )}
      {prerequisites.length > 0 && (
        <Tooltip content={t("prereqTooltip", { list })}>
          <Badge variant="warning" className={cn("cursor-default px-1.5 py-0", className)} tabIndex={0}>
            <Lock aria-hidden /> {prerequisites.length}
            <span className="sr-only">{t("prereqTooltip", { list })}</span>
          </Badge>
        </Tooltip>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The editor itself
// ---------------------------------------------------------------------------
interface PrereqRow {
  itemId: string;
  title: string;
  type: ItemType;
  minPercent: string;
}

interface FormState {
  required: boolean;
  drip: boolean;
  days: string;
  prerequisites: PrereqRow[];
}

const toState = (initial: { required?: boolean; releaseOffsetDays: number | null; prerequisites: PrerequisiteDto[] }): FormState => ({
  required: initial.required ?? true,
  drip: initial.releaseOffsetDays != null,
  days: initial.releaseOffsetDays != null ? String(initial.releaseOffsetDays) : "7",
  prerequisites: initial.prerequisites.map((p) => ({
    itemId: p.itemId,
    title: p.title,
    type: p.type,
    minPercent: p.minPercent != null ? String(p.minPercent) : "",
  })),
});

const wholeNumber = (v: string, max: number) => /^\d+$/.test(v) && Number(v) <= max;

function PrerequisitePicker({
  modules,
  excludeIds,
  onPick,
}: {
  modules: ModuleDto[];
  excludeIds: Set<string>;
  onPick: (item: ContentItemDto) => void;
}) {
  const t = useTranslations("release");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const groups = modules
    .map((m) => ({ module: m, items: m.items.filter((i) => !excludeIds.has(i.id) && (!q || i.title.toLowerCase().includes(q))) }))
    .filter((g) => g.items.length > 0);
  const available = modules.some((m) => m.items.some((i) => !excludeIds.has(i.id)));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!available}>
          <Plus /> {t("addPrereq")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchItems")}
            aria-label={t("searchItems")}
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto">
          {groups.length === 0 ? (
            <p className="px-2 py-4 text-center text-[13px] text-muted-foreground">{t("noItemsFound")}</p>
          ) : (
            groups.map((g) => (
              <div key={g.module.id} className="mb-1">
                <p className="truncate px-2 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.module.title}
                </p>
                <ul>
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                        onClick={() => {
                          onPick(i);
                          setOpen(false);
                        }}
                      >
                        <ItemTypeIcon type={i.type} className="size-6 rounded-md [&_svg]:size-3.5" />
                        <span className="min-w-0 flex-1 truncate">{i.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Remounts when the saved rules change, so the form always starts from what the server has. */
export function ReleaseRulesForm(props: FormProps) {
  return <ReleaseRulesFormInner key={JSON.stringify(toState(props.initial))} {...props} />;
}

interface FormProps {
  kind: "item" | "module";
  idPrefix: string;
  course: CourseDto;
  selfItemId?: string;
  selfModuleId?: string;
  initial: { required?: boolean; releaseOffsetDays: number | null; prerequisites: PrerequisiteDto[] };
  onSubmit: (body: ReleaseRulesRequest) => Promise<unknown>;
  pending: boolean;
  warnUnsaved?: boolean;
  onCancel?: () => void;
}

function ReleaseRulesFormInner({
  kind,
  idPrefix,
  course,
  selfItemId,
  selfModuleId,
  initial,
  onSubmit,
  pending,
  warnUnsaved,
  onCancel,
}: FormProps) {
  const t = useTranslations("release");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const [baseline] = React.useState(() => JSON.stringify(toState(initial)));
  const [state, setState] = React.useState<FormState>(() => JSON.parse(baseline) as FormState);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);

  const dirty = JSON.stringify(state) !== baseline;
  useUnsavedChanges(!!warnUnsaved && dirty);

  const daysValid = !state.drip || wholeNumber(state.days, 3650);
  const percentsValid = state.prerequisites.every((p) => p.minPercent === "" || wholeNumber(p.minPercent, 100));
  const valid = daysValid && percentsValid;

  const patch = (next: Partial<FormState>) => {
    setState((s) => ({ ...s, ...next }));
    setServerError(null);
  };
  const excluded = new Set<string>(state.prerequisites.map((p) => p.itemId));
  if (selfItemId) excluded.add(selfItemId);
  const modules =
    kind === "module" && selfModuleId ? course.modules.filter((m) => m.id !== selfModuleId) : course.modules;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const body: ReleaseRulesRequest = {
      ...(kind === "item" ? { required: state.required } : {}),
      releaseOffsetDays: state.drip ? Number(state.days) : null,
      prerequisites: state.prerequisites.map((p) => ({
        itemId: p.itemId,
        minPercent: isAssessmentType(p.type) && p.minPercent !== "" ? Number(p.minPercent) : null,
      })),
    };
    try {
      await onSubmit(body);
      toast.success(t("saved"));
    } catch (err) {
      if (isApiError(err) && err.code === "PREREQUISITE_CYCLE") setServerError(t("cycle"));
      else if (isApiError(err) && err.fieldErrors.prerequisites) setServerError(err.fieldErrors.prerequisites);
      else if (isApiError(err) && err.fieldErrors.releaseOffsetDays) setServerError(err.fieldErrors.releaseOffsetDays);
      else toast.error(errorMessage(err));
    }
  };

  const example = state.drip && daysValid ? fmt.date(addDays(new Date(), Number(state.days)), "EEE d MMM yyyy") : null;

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      {kind === "item" && (
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-required`} className="text-sm font-medium">
              {t("requiredLabel")}
            </label>
            <p id={`${idPrefix}-required-hint`} className="text-[13px] text-muted-foreground">
              {t("requiredHint")}
            </p>
          </div>
          <Switch
            id={`${idPrefix}-required`}
            checked={state.required}
            onCheckedChange={(v) => patch({ required: v })}
            aria-describedby={`${idPrefix}-required-hint`}
            className="mt-0.5"
          />
        </div>
      )}

      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-drip`} className="text-sm font-medium">
              {t("dripLabel")}
            </label>
            <p id={`${idPrefix}-drip-hint`} className="text-[13px] text-muted-foreground">
              {t("dripHint")}
            </p>
          </div>
          <Switch
            id={`${idPrefix}-drip`}
            checked={state.drip}
            onCheckedChange={(v) => patch({ drip: v })}
            aria-describedby={`${idPrefix}-drip-hint`}
            className="mt-0.5"
          />
        </div>
        {state.drip && (
          <Field
            label={t("daysLabel")}
            htmlFor={`${idPrefix}-days`}
            error={touched && !daysValid ? t("invalidDays") : undefined}
            hint={
              <span aria-live="polite">{example ? t("example", { date: example }) : t("exampleNow")}</span>
            }
            className="max-w-xs"
          >
            <Input
              id={`${idPrefix}-days`}
              type="number"
              min={0}
              max={3650}
              inputMode="numeric"
              value={state.days}
              aria-invalid={touched && !daysValid ? true : undefined}
              onChange={(e) => patch({ days: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-medium">{t("prereqTitle")}</h3>
          <p className="text-[13px] text-muted-foreground">{t("prereqHint")}</p>
        </div>
        {state.prerequisites.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-[13px] text-muted-foreground">{t("prereqNone")}</p>
        ) : (
          <ul className="grid gap-2">
            {state.prerequisites.map((p, idx) => {
              const bad = touched && p.minPercent !== "" && !wholeNumber(p.minPercent, 100);
              return (
                <li key={p.itemId} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-2.5 py-2">
                  <ItemTypeIcon type={p.type} className="size-7" />
                  <span className="min-w-0 flex-1 basis-40 text-sm font-medium [overflow-wrap:anywhere]">{p.title}</span>
                  {isAssessmentType(p.type) && (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`${idPrefix}-min-${idx}`} className="text-xs text-muted-foreground">
                        {t("minScoreLabel")}
                      </label>
                      <div className="relative">
                        <Input
                          id={`${idPrefix}-min-${idx}`}
                          type="number"
                          min={0}
                          max={100}
                          inputMode="numeric"
                          placeholder={t("minScoreHint")}
                          value={p.minPercent}
                          aria-invalid={bad ? true : undefined}
                          aria-describedby={bad ? `${idPrefix}-min-${idx}-error` : undefined}
                          className="h-8 w-24 pr-6 text-sm"
                          onChange={(e) =>
                            patch({
                              prerequisites: state.prerequisites.map((x, i) => (i === idx ? { ...x, minPercent: e.target.value } : x)),
                            })
                          }
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      {bad && (
                        <span id={`${idPrefix}-min-${idx}-error`} role="alert" className="text-xs text-destructive">
                          {t("invalidPercent")}
                        </span>
                      )}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("removePrereq", { title: p.title })}
                    onClick={() => patch({ prerequisites: state.prerequisites.filter((_, i) => i !== idx) })}
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <PrerequisitePicker
            modules={modules}
            excludeIds={excluded}
            onPick={(item) =>
              patch({
                prerequisites: [
                  ...state.prerequisites,
                  { itemId: item.id, title: item.title, type: item.type, minPercent: "" },
                ],
              })
            }
          />
        </div>
      </div>

      {serverError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tc("cancel")}
          </Button>
        )}
        <Button type="submit" loading={pending} disabled={!dirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Item editor tab
// ---------------------------------------------------------------------------
export function ItemReleasePanel({ item }: { item: ContentItemDto }) {
  const t = useTranslations("release");
  const course = useInstructorCourse(item.courseId);
  const set = useSetItemRelease(item.courseId);
  if (!course.data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("itemDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ReleaseRulesForm
          kind="item"
          idPrefix="item-release"
          course={course.data}
          selfItemId={item.id}
          initial={item}
          pending={set.isPending}
          warnUnsaved
          onSubmit={(body) => set.mutateAsync({ id: item.id, body })}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Module dialog content
// ---------------------------------------------------------------------------
export function ModuleReleaseForm({ module, course, onDone }: { module: ModuleDto; course: CourseDto; onDone: () => void }) {
  const set = useSetModuleRelease(course.id);
  return (
    <ReleaseRulesForm
      kind="module"
      idPrefix="module-release"
      course={course}
      selfModuleId={module.id}
      initial={module}
      pending={set.isPending}
      onCancel={onDone}
      onSubmit={(body) => set.mutateAsync({ id: module.id, body }).then(onDone)}
    />
  );
}
