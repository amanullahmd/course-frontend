"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AssignmentDto } from "@/lib/api/types";
import { isApiError } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAssignmentSettings, useSaveAssignment } from "@/hooks/queries/practice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ErrorState } from "@/components/ui/error-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface Form {
  dueAt: string | null;
  allowLate: boolean;
  maxPoints: string;
  maxFiles: string;
  maxSubmissions: string;
  allowText: boolean;
}

const toForm = (a: AssignmentDto): Form => ({
  dueAt: a.dueAt,
  allowLate: a.allowLate,
  maxPoints: String(a.maxPoints),
  maxFiles: String(a.maxFiles),
  maxSubmissions: String(a.maxSubmissions),
  allowText: a.allowText,
});

function intIn(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function Settings({ itemId, assignment }: { itemId: string; assignment: AssignmentDto }) {
  const t = useTranslations("assignments");
  const errorMessage = useErrorMessage();
  const save = useSaveAssignment(itemId);
  const initial = React.useMemo(() => toForm(assignment), [assignment]);
  const [form, setForm] = React.useState<Form>(initial);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Form, string>>>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const maxPoints = intIn(form.maxPoints, 1, 1000);
    const maxFiles = intIn(form.maxFiles, 0, 20);
    const maxSubmissions = intIn(form.maxSubmissions, 1, 20);
    const next: Partial<Record<keyof Form, string>> = {};
    if (maxPoints === null) next.maxPoints = t("rangeError", { min: 1, max: 1000 });
    if (maxFiles === null) next.maxFiles = t("rangeError", { min: 0, max: 20 });
    if (maxSubmissions === null) next.maxSubmissions = t("rangeError", { min: 1, max: 20 });
    if (!form.allowText && maxFiles === 0) next.allowText = t("nothingToSubmit");
    setErrors(next);
    if (Object.keys(next).length > 0 || maxPoints === null || maxFiles === null || maxSubmissions === null) return;
    save.mutate(
      { dueAt: form.dueAt, allowLate: form.allowLate, maxPoints, maxFiles, maxSubmissions, allowText: form.allowText },
      {
        onSuccess: () => toast.success(t("settingsSaved")),
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fieldErrors).length > 0) {
            setErrors(err.fieldErrors as Partial<Record<keyof Form, string>>);
          } else toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t("settingsTitle")}</CardTitle>
          <CardDescription>{t("settingsText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field label={t("due")} htmlFor="as-due" hint={t("dueHint")}>
            <DateTimePicker id="as-due" value={form.dueAt} onChange={(v) => set("dueAt", v)} className="max-w-sm" />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={form.allowLate} onCheckedChange={(v) => set("allowLate", v)} aria-label={t("allowLate")} className="mt-0.5" />
            <span>
              <span className="block font-medium">{t("allowLate")}</span>
              <span className="text-muted-foreground">{t("allowLateHint")}</span>
            </span>
          </label>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={t("maxPoints")} htmlFor="as-points" error={errors.maxPoints}>
              <Input id="as-points" inputMode="numeric" value={form.maxPoints} onChange={(e) => set("maxPoints", e.target.value)} aria-invalid={!!errors.maxPoints || undefined} />
            </Field>
            <Field label={t("maxFilesLabel")} htmlFor="as-files" error={errors.maxFiles} hint={t("maxFilesHint")}>
              <Input id="as-files" inputMode="numeric" value={form.maxFiles} onChange={(e) => set("maxFiles", e.target.value)} aria-invalid={!!errors.maxFiles || undefined} />
            </Field>
            <Field label={t("maxSubmissionsLabel")} htmlFor="as-subs" error={errors.maxSubmissions} hint={t("maxSubmissionsHint")}>
              <Input id="as-subs" inputMode="numeric" value={form.maxSubmissions} onChange={(e) => set("maxSubmissions", e.target.value)} aria-invalid={!!errors.maxSubmissions || undefined} />
            </Field>
          </div>
          <div className="grid gap-2">
            <label className="flex items-start gap-3 text-sm">
              <Switch checked={form.allowText} onCheckedChange={(v) => set("allowText", v)} aria-label={t("allowText")} className="mt-0.5" />
              <span>
                <span className="block font-medium">{t("allowText")}</span>
                <span className="text-muted-foreground">{t("allowTextHint")}</span>
              </span>
            </label>
            {errors.allowText && (
              <p role="alert" className="text-[13px] text-destructive">
                {errors.allowText}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">{t("unsaved")}</span>}
        <Button type="submit" loading={save.isPending} disabled={!dirty}>
          <Save /> {t("saveSettings")}
        </Button>
      </div>
    </form>
  );
}

/** Instructor settings of an ASSIGNMENT item (due date, late policy, points, files, resubmissions). */
export function AssignmentEditor({ itemId }: { itemId: string }) {
  const settings = useAssignmentSettings(itemId);
  if (settings.isPending) return <Skeleton className="h-72 rounded-xl" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  return <Settings key={settings.dataUpdatedAt} itemId={itemId} assignment={settings.data} />;
}
