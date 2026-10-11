"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DoorOpen, ImageUp, ShieldCheck, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CourseDto, CourseUpsert, MediaDto } from "@/lib/api/types";
import { CEFR_LEVELS, CEFR_META } from "@/lib/constants";
import { useErrorMessage } from "@/hooks/use-error-message";
import { applyServerErrors } from "@/lib/form-errors";
import { useHotkey } from "@/hooks/use-hotkey";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useUploads } from "@/hooks/use-uploads";
import { CourseCover } from "@/components/course/course-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldA11y } from "@/components/ui/field";
import { FileDropzone, UploadProgressList } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagsInput } from "@/components/ui/tags-input";
import { RichTextEditor } from "./rich-text-editor";
import { toast } from "sonner";

type FormT = (key: "validation.titleMin" | "validation.tooLong" | "validation.wholeNumber") => string;

const makeSchema = (t: FormT) =>
  z.object({
    title: z.string().trim().min(3, t("validation.titleMin")).max(200, t("validation.tooLong")),
    subtitle: z.string().trim().max(300, t("validation.tooLong")),
    description: z.string().max(20000, t("validation.tooLong")),
    level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    tags: z.array(z.string()).max(20),
    enrollmentMode: z.enum(["APPROVAL", "OPEN"]),
    capacity: z.string().regex(/^\d*$/, t("validation.wholeNumber")),
    cover: z.custom<MediaDto | null>(),
  });
export type CourseFormValues = z.infer<ReturnType<typeof makeSchema>>;

export function courseToForm(course?: CourseDto): CourseFormValues {
  return {
    title: course?.title ?? "",
    subtitle: course?.subtitle ?? "",
    description: course?.description ?? "",
    level: course?.level ?? "A1",
    tags: course?.tags ?? [],
    enrollmentMode: course?.enrollmentMode ?? "APPROVAL",
    capacity: course?.capacity != null ? String(course.capacity) : "",
    cover: course?.coverImage ?? null,
  };
}

export function formToUpsert(values: CourseFormValues): CourseUpsert {
  return {
    title: values.title.trim(),
    subtitle: values.subtitle.trim() || null,
    description: values.description.trim() || null,
    level: values.level,
    tags: values.tags,
    coverImageId: values.cover?.id ?? null,
    enrollmentMode: values.enrollmentMode,
    capacity: values.capacity ? Number(values.capacity) : null,
  };
}

function CoverField({
  value,
  onChange,
  title,
}: {
  value: CourseFormValues["cover"];
  onChange: (value: CourseFormValues["cover"]) => void;
  title: string;
}) {
  const t = useTranslations("courseForm");
  const { uploads, upload, cancel, dismiss, retry } = useUploads({ onUploaded: (media) => onChange(media) });
  return (
    <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted">
        <CourseCover title={title || "Course"} src={value?.url ?? null} />
        {value?.url && (
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            className="absolute top-2 right-2 shadow"
            onClick={() => onChange(null)}
            aria-label={t("removeCover")}
          >
            <Trash />
          </Button>
        )}
      </div>
      <div className="grid gap-2">
        <FileDropzone
          compact
          multiple={false}
          accept="image/*"
          onFiles={upload}
          title={value?.url ? t("replaceCover") : t("uploadCover")}
          hint={t("coverHint")}
        />
        <UploadProgressList uploads={uploads} onCancel={cancel} onRetry={retry} onDismiss={dismiss} />
      </div>
    </div>
  );
}

export function CourseForm({
  course,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  course?: CourseDto;
  submitLabel: string;
  onSubmit: (body: CourseUpsert) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const schema = React.useMemo(() => makeSchema((k) => t(k)), [t]);
  const values = React.useMemo(() => courseToForm(course), [course]);
  const form = useForm<CourseFormValues>({ resolver: zodResolver(schema), values, resetOptions: { keepDirtyValues: false } });
  const { errors, isSubmitting, isDirty } = form.formState;
  useUnsavedChanges(isDirty && !isSubmitting);

  const submit = form.handleSubmit(async (v) => {
    try {
      await onSubmit(formToUpsert(v));
      form.reset(v);
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ["title", "subtitle", "description", "level", "tags", "enrollmentMode", "capacity"])) {
        toast.error(errorMessage(err));
      }
    }
  });
  useHotkey("mod+s", (e) => {
    e.preventDefault();
    void submit();
  });

  const title = useWatch({ control: form.control, name: "title" });

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t("courseForm.basics")}</CardTitle>
          <CardDescription>{t("courseForm.basicsText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field label={t("courseForm.title")} htmlFor="title" error={errors.title?.message} required>
            <Input placeholder="Deutsch für den Alltag" {...fieldA11y("title", errors.title?.message)} {...form.register("title")} />
          </Field>
          <Field label={t("courseForm.subtitle")} htmlFor="subtitle" error={errors.subtitle?.message} hint={t("courseForm.subtitleHint")}>
            <Input placeholder="Sicher kommunizieren in Alltagssituationen" {...fieldA11y("subtitle", errors.subtitle?.message)} {...form.register("subtitle")} />
          </Field>
          <Field label={t("courseForm.description")} htmlFor="description" error={errors.description?.message} hint={t("courseForm.descriptionHint")}>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <RichTextEditor id="description" value={field.value} onChange={field.onChange} placeholder={t("courseForm.descriptionPlaceholder")} className="[&_.tiptap]:min-h-40" />
              )}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("courseForm.level")} htmlFor="level" error={errors.level?.message} required>
              <Controller
                control={form.control}
                name="level"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CEFR_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${CEFR_META[l].dot}`} />
                            <span className="font-semibold">{l}</span>
                            <span className="text-muted-foreground">{t(`levels.${l}.name`)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={t("courseForm.tags")} htmlFor="tags" hint={t("courseForm.tagsHint")}>
              <Controller
                control={form.control}
                name="tags"
                render={({ field }) => <TagsInput id="tags" value={field.value} onChange={field.onChange} placeholder={t("courseForm.tagsPlaceholder")} />}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageUp className="size-4" /> {t("courseForm.cover")}
          </CardTitle>
          <CardDescription>{t("courseForm.coverText")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller control={form.control} name="cover" render={({ field }) => <CoverField value={field.value} onChange={(v) => field.onChange(v)} title={title} />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("courseForm.enrollment")}</CardTitle>
          <CardDescription>{t("courseForm.enrollmentText")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Controller
            control={form.control}
            name="enrollmentMode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2" aria-label={t("courseForm.enrollmentMode")}>
                <RadioCard value="APPROVAL" icon={<ShieldCheck />} title={t("enrollmentMode.APPROVAL.label")} description={t("enrollmentMode.APPROVAL.description")} />
                <RadioCard value="OPEN" icon={<DoorOpen />} title={t("enrollmentMode.OPEN.label")} description={t("enrollmentMode.OPEN.description")} />
              </RadioGroup>
            )}
          />
          <Field label={t("courseForm.capacity")} htmlFor="capacity" error={errors.capacity?.message} hint={t("courseForm.capacityHint")} className="max-w-xs">
            <Input type="number" min={1} inputMode="numeric" placeholder={t("common.unlimited")} {...fieldA11y("capacity", errors.capacity?.message)} {...form.register("capacity")} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/85 px-1 py-3 backdrop-blur">
        {isDirty && (
          <span className="mr-auto text-xs text-muted-foreground">
            {t("courseForm.unsavedShortcut")} <Kbd>⌘/Ctrl</Kbd> <Kbd>S</Kbd>
          </span>
        )}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} disabled={!!course && !isDirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
