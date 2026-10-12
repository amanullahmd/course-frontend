"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useCloneCourse } from "@/hooks/queries/instructor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Schedule = "keep" | "remove";

/** "Clone course": an independent draft copy, optionally with all dates shifted by whole weeks. */
export function CloneCourseDialog({
  course,
  open,
  onOpenChange,
}: {
  course: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CloneForm course={course} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function CloneForm({ course, onOpenChange }: { course: { id: string; title: string }; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("clone");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const clone = useCloneCourse();
  const [title, setTitle] = React.useState(() => t("defaultTitle", { title: course.title }).slice(0, 200));
  const [schedule, setSchedule] = React.useState<Schedule>("keep");
  const [weeks, setWeeks] = React.useState("0");
  const [touched, setTouched] = React.useState(false);

  const titleOk = title.trim().length > 0;
  const weeksOk = schedule === "remove" || (/^-?\d+$/.test(weeks) && Math.abs(Number(weeks)) <= 520);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!titleOk || !weeksOk) return;
    clone.mutate(
      {
        id: course.id,
        body: {
          title: title.trim(),
          keepSchedule: schedule === "keep",
          shiftDays: schedule === "keep" ? Number(weeks) * 7 : null,
        },
      },
      {
        onSuccess: (copy) => {
          toast.success(t("created"));
          onOpenChange(false);
          router.push(`/instructor/courses/${copy.id}`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <Field label={t("titleLabel")} htmlFor="clone-title" error={touched && !titleOk ? t("titleRequired") : undefined} required>
            <Input
              id="clone-title"
              value={title}
              maxLength={200}
              autoFocus
              aria-invalid={touched && !titleOk ? true : undefined}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">{t("scheduleLabel")}</legend>
            <RadioGroup value={schedule} onValueChange={(v) => setSchedule(v as Schedule)} aria-label={t("scheduleLabel")}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-soft/40">
                <RadioGroupItem value="keep" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{t("keepDates")}</span>
                  <span className="text-[13px] text-muted-foreground">{t("keepDatesHint")}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-soft/40">
                <RadioGroupItem value="remove" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{t("removeDates")}</span>
                  <span className="text-[13px] text-muted-foreground">{t("removeDatesHint")}</span>
                </span>
              </label>
            </RadioGroup>
            {schedule === "keep" && (
              <Field
                label={t("shiftLabel")}
                htmlFor="clone-weeks"
                error={touched && !weeksOk ? t("invalidShift") : undefined}
                hint={t("shiftHint")}
                className="max-w-48"
              >
                <Input
                  id="clone-weeks"
                  type="number"
                  inputMode="numeric"
                  min={-520}
                  max={520}
                  value={weeks}
                  aria-invalid={touched && !weeksOk ? true : undefined}
                  onChange={(e) => setWeeks(e.target.value)}
                />
              </Field>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={clone.isPending}>
              {t("submit")}
            </Button>
          </DialogFooter>
    </form>
  );
}
