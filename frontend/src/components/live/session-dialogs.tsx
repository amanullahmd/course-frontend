"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { LiveSessionDto } from "@/lib/api/types";
import { isApiError } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useCreateSeries, useCreateSession, useUpdateSession } from "@/hooks/queries/practice";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const httpUrl = (v: string) => !v.trim() || /^https?:\/\/\S+\.\S+/i.test(v.trim());

function roundedNextHour(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 25);
  return d.toISOString();
}

interface Form {
  title: string;
  description: string;
  startsAt: string | null;
  duration: string;
  joinUrl: string;
  recordingUrl: string;
  cancelled: boolean;
}

function SessionForm({ courseId, session, onClose }: { courseId: string; session: LiveSessionDto | null; onClose: () => void }) {
  const t = useTranslations("live");
  const errorMessage = useErrorMessage();
  const create = useCreateSession(courseId);
  const update = useUpdateSession(courseId);
  const [form, setForm] = React.useState<Form>(() => ({
    title: session?.title ?? "",
    description: session?.description ?? "",
    startsAt: session?.startsAt ?? roundedNextHour(),
    duration: String(session?.durationMinutes ?? 60),
    joinUrl: session?.joinUrl ?? "",
    recordingUrl: session?.recordingUrl ?? "",
    cancelled: session?.cancelled ?? false,
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const minutes = /^\d+$/.test(form.duration.trim()) ? Number(form.duration) : NaN;
    if (!form.title.trim()) next.title = t("titleRequired");
    if (!form.startsAt) next.startsAt = t("startRequired");
    if (!(minutes >= 5 && minutes <= 720)) next.durationMinutes = t("durationRange");
    if (!httpUrl(form.joinUrl)) next.joinUrl = t("urlInvalid");
    if (!httpUrl(form.recordingUrl)) next.recordingUrl = t("urlInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0 || !form.startsAt) return;
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      startsAt: form.startsAt,
      durationMinutes: minutes,
      joinUrl: form.joinUrl.trim() || null,
      recordingUrl: form.recordingUrl.trim() || null,
      cancelled: form.cancelled,
    };
    const options = {
      onSuccess: () => {
        toast.success(session ? t("sessionSaved") : t("sessionCreated"));
        onClose();
      },
      onError: (err: unknown) => {
        if (isApiError(err) && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
        else toast.error(errorMessage(err));
      },
    };
    if (session) update.mutate({ id: session.id, body }, options);
    else create.mutate(body, options);
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{session ? t("editSession") : t("newSession")}</DialogTitle>
        <DialogDescription>{t("sessionDialogText")}</DialogDescription>
      </DialogHeader>
      <Field label={t("fieldTitle")} htmlFor="ls-title" error={errors.title} required>
        <Input id="ls-title" value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title || undefined} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label={t("fieldStart")} htmlFor="ls-start" error={errors.startsAt} required>
          <DateTimePicker id="ls-start" clearable={false} value={form.startsAt} onChange={(v) => set("startsAt", v)} aria-invalid={!!errors.startsAt} />
        </Field>
        <Field label={t("fieldDuration")} htmlFor="ls-duration" error={errors.durationMinutes}>
          <Input id="ls-duration" inputMode="numeric" value={form.duration} onChange={(e) => set("duration", e.target.value)} aria-invalid={!!errors.durationMinutes || undefined} />
        </Field>
      </div>
      <Field label={t("fieldJoinUrl")} htmlFor="ls-join" error={errors.joinUrl} hint={t("joinUrlHint")}>
        <Input id="ls-join" type="url" inputMode="url" placeholder="https://" value={form.joinUrl} onChange={(e) => set("joinUrl", e.target.value)} aria-invalid={!!errors.joinUrl || undefined} />
      </Field>
      <Field label={t("fieldRecording")} htmlFor="ls-rec" error={errors.recordingUrl} hint={t("recordingHint")}>
        <Input id="ls-rec" type="url" inputMode="url" placeholder="https://" value={form.recordingUrl} onChange={(e) => set("recordingUrl", e.target.value)} aria-invalid={!!errors.recordingUrl || undefined} />
      </Field>
      <Field label={t("fieldDescription")} htmlFor="ls-desc" error={errors.description}>
        <Textarea id="ls-desc" rows={3} value={form.description} maxLength={5000} onChange={(e) => set("description", e.target.value)} />
      </Field>
      {session && (
        <label className="flex items-start gap-3 text-sm">
          <Switch checked={form.cancelled} onCheckedChange={(v) => set("cancelled", v)} aria-label={t("cancelSession")} className="mt-0.5" />
          <span>
            <span className="block font-medium">{t("cancelSession")}</span>
            <span className="text-muted-foreground">{t("cancelSessionHint")}</span>
          </span>
        </label>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          {session ? t("saveSession") : t("createSession")}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create / edit dialog of a single session. `session = null` creates. */
export function SessionDialog({
  courseId,
  open,
  session,
  onOpenChange,
}: {
  courseId: string;
  open: boolean;
  session: LiveSessionDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {open && <SessionForm key={session?.id ?? "new"} courseId={courseId} session={session} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SeriesForm({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const t = useTranslations("live");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const create = useCreateSeries(courseId);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [first, setFirst] = React.useState<string | null>(roundedNextHour());
  const [weeks, setWeeks] = React.useState("8");
  const [duration, setDuration] = React.useState("60");
  const [joinUrl, setJoinUrl] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const n = /^\d+$/.test(weeks.trim()) ? Number(weeks) : NaN;
  const lastStart = first && n >= 1 ? new Date(Date.parse(first) + (n - 1) * 7 * 86_400_000).toISOString() : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = /^\d+$/.test(duration.trim()) ? Number(duration) : NaN;
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("titleRequired");
    if (!first) next.firstStartsAt = t("startRequired");
    if (!(n >= 1 && n <= 52)) next.weeks = t("weeksRange");
    if (!(minutes >= 5 && minutes <= 720)) next.durationMinutes = t("durationRange");
    if (!httpUrl(joinUrl)) next.joinUrl = t("urlInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0 || !first) return;
    create.mutate(
      { title: title.trim(), description: description.trim() || null, firstStartsAt: first, weeks: n, durationMinutes: minutes, joinUrl: joinUrl.trim() || null },
      {
        onSuccess: (list) => {
          toast.success(t("seriesCreated", { count: list.length }));
          onClose();
        },
        onError: (err) => {
          if (isApiError(err) && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors);
          else toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{t("newSeries")}</DialogTitle>
        <DialogDescription>{t("seriesText")}</DialogDescription>
      </DialogHeader>
      <Field label={t("fieldTitle")} htmlFor="sr-title" error={errors.title} required>
        <Input id="sr-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title || undefined} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem_8rem]">
        <Field label={t("firstSession")} htmlFor="sr-first" error={errors.firstStartsAt} required>
          <DateTimePicker id="sr-first" clearable={false} value={first} onChange={setFirst} />
        </Field>
        <Field label={t("weeks")} htmlFor="sr-weeks" error={errors.weeks}>
          <Input id="sr-weeks" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} aria-invalid={!!errors.weeks || undefined} />
        </Field>
        <Field label={t("fieldDuration")} htmlFor="sr-duration" error={errors.durationMinutes}>
          <Input id="sr-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} aria-invalid={!!errors.durationMinutes || undefined} />
        </Field>
      </div>
      {lastStart && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("seriesPreview", { count: n, last: fmt.date(lastStart, "EEE d MMM yyyy") })}
        </p>
      )}
      <Field label={t("fieldJoinUrl")} htmlFor="sr-join" error={errors.joinUrl} hint={t("joinUrlHint")}>
        <Input id="sr-join" type="url" inputMode="url" placeholder="https://" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} aria-invalid={!!errors.joinUrl || undefined} />
      </Field>
      <Field label={t("fieldDescription")} htmlFor="sr-desc">
        <Textarea id="sr-desc" rows={2} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">{t("dstNote")}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={create.isPending}>
          {t("createSeries")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SeriesDialog({ courseId, open, onOpenChange }: { courseId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">{open && <SeriesForm courseId={courseId} onClose={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}
