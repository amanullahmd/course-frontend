"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DoorOpen, ImageUp, ShieldCheck, Trash } from "lucide-react";
import type { CourseDto, CourseUpsert, MediaDto } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api/client";
import { CEFR_LEVELS, CEFR_META, ENROLLMENT_MODE_META } from "@/lib/constants";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(200),
  subtitle: z.string().trim().max(300),
  description: z.string().max(20000),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  tags: z.array(z.string()).max(20),
  enrollmentMode: z.enum(["APPROVAL", "OPEN"]),
  capacity: z.string().regex(/^\d*$/, "Whole number of seats"),
  cover: z.custom<MediaDto | null>(),
});
export type CourseFormValues = z.infer<typeof schema>;

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
            aria-label="Remove cover image"
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
          title={value?.url ? "Replace cover image" : "Upload a cover image"}
          hint="JPG, PNG or WebP · 1600×900 recommended"
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
        toast.error(getErrorMessage(err));
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
          <CardTitle>Basics</CardTitle>
          <CardDescription>What learners see first in the catalog.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field label="Title" htmlFor="title" error={errors.title?.message} required>
            <Input placeholder="Deutsch für den Alltag" {...fieldA11y("title", errors.title?.message)} {...form.register("title")} />
          </Field>
          <Field label="Subtitle" htmlFor="subtitle" error={errors.subtitle?.message} hint="One sentence that sums up the course.">
            <Input placeholder="Sicher kommunizieren in Alltagssituationen" {...fieldA11y("subtitle", errors.subtitle?.message)} {...form.register("subtitle")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description?.message} hint="Goals, target group, materials, rhythm (e.g. one unit per week).">
            <Textarea rows={7} {...fieldA11y("description", errors.description?.message)} {...form.register("description")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="CEFR level" htmlFor="level" error={errors.level?.message} required>
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
                            <span className="text-muted-foreground">{CEFR_META[l].name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Press Enter or comma to add.">
              <Controller
                control={form.control}
                name="tags"
                render={({ field }) => <TagsInput id="tags" value={field.value} onChange={field.onChange} placeholder="Grammatik, Beruf, Prüfung…" />}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageUp className="size-4" /> Cover image
          </CardTitle>
          <CardDescription>Optional. Without a cover, Sprachweg generates a calm gradient.</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller control={form.control} name="cover" render={({ field }) => <CoverField value={field.value} onChange={(v) => field.onChange(v)} title={title} />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment</CardTitle>
          <CardDescription>Decide how learners join your course.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Controller
            control={form.control}
            name="enrollmentMode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2" aria-label="Enrollment mode">
                <RadioCard value="APPROVAL" icon={<ShieldCheck />} title={ENROLLMENT_MODE_META.APPROVAL.label} description={ENROLLMENT_MODE_META.APPROVAL.description} />
                <RadioCard value="OPEN" icon={<DoorOpen />} title={ENROLLMENT_MODE_META.OPEN.label} description={ENROLLMENT_MODE_META.OPEN.description} />
              </RadioGroup>
            )}
          />
          <Field label="Capacity" htmlFor="capacity" error={errors.capacity?.message} hint="Maximum number of approved learners. Leave empty for unlimited." className="max-w-xs">
            <Input type="number" min={1} inputMode="numeric" placeholder="Unlimited" {...fieldA11y("capacity", errors.capacity?.message)} {...form.register("capacity")} />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 border-t bg-background/85 px-1 py-3 backdrop-blur">
        {isDirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes · <Kbd>⌘/Ctrl</Kbd> <Kbd>S</Kbd></span>}
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting} disabled={!!course && !isDirty}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
