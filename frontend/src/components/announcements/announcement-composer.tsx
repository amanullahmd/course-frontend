"use client";

import * as React from "react";
import { CalendarClock, Info, Mail, Pin, Send, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import type { AnnouncementDto, AnnouncementUpsert } from "@/lib/api/announcements";
import type { EnrollmentDto } from "@/lib/api/types";
import { timeZoneName } from "@/lib/dates";
import { stripHtml } from "@/lib/utils";
import { useAnnouncementMutations } from "@/hooks/queries/announcements";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { RichTextEditor } from "@/components/builder/rich-text-editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { LearnerPicker } from "./learner-picker";

/** What the composer starts from: an existing announcement (edit), a copy (duplicate) or nothing (new). */
export interface ComposerState {
  announcement?: AnnouncementDto;
  copyOf?: AnnouncementDto;
}

interface FormState {
  title: string;
  body: string;
  audience: AnnouncementUpsert["audience"];
  recipientIds: Set<string>;
  sendEmail: boolean;
  pinned: boolean;
  scheduledAt: string | null;
}

type Errors = Partial<Record<"title" | "body" | "recipientIds" | "scheduledAt", string>>;

function initialForm(state: ComposerState, approvedIds: Set<string>, copySuffix: string): FormState {
  const src = state.announcement ?? state.copyOf;
  if (!src) {
    return { title: "", body: "", audience: "ALL_APPROVED", recipientIds: new Set(), sendEmail: true, pinned: false, scheduledAt: null };
  }
  return {
    title: state.copyOf ? `${src.title} ${copySuffix}`.slice(0, 200) : src.title,
    body: src.body,
    audience: src.audience,
    recipientIds: new Set(state.copyOf ? src.recipientIds.filter((id) => approvedIds.has(id)) : src.recipientIds),
    sendEmail: src.sendEmail,
    pinned: src.pinned,
    scheduledAt: state.announcement?.status === "SCHEDULED" ? src.scheduledAt : null,
  };
}

const sameForm = (a: FormState, b: FormState) =>
  a.title === b.title &&
  a.body === b.body &&
  a.audience === b.audience &&
  a.sendEmail === b.sendEmail &&
  a.pinned === b.pinned &&
  a.scheduledAt === b.scheduledAt &&
  a.recipientIds.size === b.recipientIds.size &&
  [...a.recipientIds].every((id) => b.recipientIds.has(id));

export function AnnouncementComposer({
  courseId,
  state,
  onClose,
  learners,
  learnersLoading,
}: {
  courseId: string;
  /** null = closed */
  state: ComposerState | null;
  onClose: () => void;
  learners: EnrollmentDto[];
  learnersLoading: boolean;
}) {
  // Close requests (Escape, overlay, close button) go through the form's "unsaved changes" guard.
  const guard = React.useRef<(() => void) | null>(null);
  const setGuard = React.useCallback((fn: (() => void) | null) => {
    guard.current = fn;
  }, []);
  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && (guard.current ? guard.current() : onClose())}>
      <SheetContent side="right" className="w-[min(100vw,44rem)] gap-0 p-0 sm:w-[min(100vw-2rem,44rem)]">
        {state && (
          <ComposerForm
            key={state.announcement?.id ?? state.copyOf?.id ?? "new"}
            courseId={courseId}
            state={state}
            onClose={onClose}
            learners={learners}
            learnersLoading={learnersLoading}
            setGuard={setGuard}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ComposerForm({
  courseId,
  state,
  onClose,
  learners,
  learnersLoading,
  setGuard,
}: {
  courseId: string;
  state: ComposerState;
  onClose: () => void;
  learners: EnrollmentDto[];
  learnersLoading: boolean;
  setGuard: (fn: (() => void) | null) => void;
}) {
  const t = useTranslations("announcements.composer");
  const ta = useTranslations("announcements");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const { save, saveAndSend } = useAnnouncementMutations(courseId);
  const approvedIds = React.useMemo(() => new Set(learners.map((e) => e.student.id)), [learners]);
  const [initial] = React.useState(() => initialForm(state, approvedIds, ta("copySuffix")));
  const [form, setForm] = React.useState<FormState>(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [confirmSend, setConfirmSend] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const existing = state.announcement;
  const isSent = existing?.status === "SENT";
  const pending = save.isPending || saveAndSend.isPending;
  const recipientCount = form.audience === "ALL_APPROVED" ? approvedIds.size : [...form.recipientIds].filter((id) => approvedIds.has(id)).length;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Unsaved changes: ask before closing (Escape / overlay / close button are routed through onClose by the Sheet).
  const dirty = !sameForm(form, initial);
  const requestClose = React.useCallback(() => (dirty && !pending ? setConfirmDiscard(true) : onClose()), [dirty, pending, onClose]);
  React.useEffect(() => {
    setGuard(requestClose);
    return () => setGuard(null);
  }, [setGuard, requestClose]);

  const validate = (withSchedule: boolean): Errors => {
    const e: Errors = {};
    if (!form.title.trim()) e.title = t("titleRequired");
    if (!stripHtml(form.body) && !form.body.includes("<img")) e.body = t("bodyRequired");
    if (!isSent && form.audience === "SELECTED" && form.recipientIds.size === 0) e.recipientIds = t("recipientsRequired");
    if (withSchedule && (!form.scheduledAt || Date.parse(form.scheduledAt) <= Date.now())) e.scheduledAt = t("scheduleRequired");
    return e;
  };

  const payload = (status: AnnouncementUpsert["status"]): AnnouncementUpsert => ({
    title: form.title.trim(),
    body: form.body,
    audience: form.audience,
    recipientIds: form.audience === "SELECTED" ? [...form.recipientIds] : [],
    sendEmail: form.sendEmail,
    pinned: form.pinned,
    status,
    scheduledAt: status === "SCHEDULED" ? form.scheduledAt : null,
  });

  const onError = (e: unknown) => {
    if (isApiError(e) && Object.keys(e.fieldErrors).length > 0) {
      setErrors({
        title: e.fieldErrors.title,
        body: e.fieldErrors.body,
        recipientIds: e.fieldErrors.recipientIds,
        scheduledAt: e.fieldErrors.scheduledAt,
      });
    }
    toast.error(errorMessage(e));
  };

  const submit = (kind: "draft" | "schedule" | "send" | "update") => {
    const e = validate(kind === "schedule");
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (kind === "send") {
      setConfirmSend(true);
      return;
    }
    const status = kind === "schedule" ? "SCHEDULED" : "DRAFT";
    save.mutate(
      { id: existing?.id, body: payload(status) },
      {
        onSuccess: (a) => {
          toast.success(
            kind === "update" ? t("updated") : kind === "schedule" ? t("scheduledToast", { date: fmt.dateTime(a.scheduledAt) }) : t("saved"),
          );
          setScheduleOpen(false);
          onClose();
        },
        onError,
      },
    );
  };

  const sendNow = () =>
    saveAndSend.mutate(
      { id: existing?.id, body: payload("DRAFT") },
      {
        onSuccess: (a) => {
          toast.success(t("sentToast", { count: a.recipientCount }));
          setConfirmSend(false);
          onClose();
        },
        onError: (e) => {
          setConfirmSend(false);
          onError(e);
        },
      },
    );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader>
          <SheetTitle>{existing ? t("editTitle") : t("newTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 p-5">
            {isSent && (
              <div className="flex gap-2.5 rounded-lg border border-info/25 bg-info-soft/50 p-3 text-[13px] text-info">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>{t("sentNotice", { date: fmt.dateTime(existing?.sentAt) })}</p>
              </div>
            )}
            <Field label={t("titleLabel")} htmlFor="ann-title" error={errors.title} required>
              <Input
                id="ann-title"
                value={form.title}
                maxLength={200}
                onChange={(e) => set("title", e.target.value)}
                placeholder={t("titlePlaceholder")}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "ann-title-error" : undefined}
                autoFocus
              />
            </Field>
            <Field label={t("bodyLabel")} htmlFor="ann-body" error={errors.body} required>
              <RichTextEditor id="ann-body" value={form.body} onChange={(html) => set("body", html)} placeholder={t("bodyPlaceholder")} className="[&_.tiptap]:min-h-48" />
            </Field>

            <fieldset className="grid gap-3" disabled={isSent}>
              <legend className="mb-3 text-sm font-medium">{t("audienceLabel")}</legend>
              <RadioGroup
                value={form.audience}
                onValueChange={(v) => set("audience", v as FormState["audience"])}
                className="grid gap-3 sm:grid-cols-2"
                disabled={isSent}
              >
                <RadioCard
                  value="ALL_APPROVED"
                  icon={<UsersRound />}
                  title={t("audienceAllTitle")}
                  description={t("audienceAllText", { count: approvedIds.size })}
                  className={isSent ? "opacity-60" : undefined}
                />
                <RadioCard
                  value="SELECTED"
                  icon={<Users />}
                  title={t("audienceSelectedTitle")}
                  description={t("audienceSelectedText")}
                  className={isSent ? "opacity-60" : undefined}
                />
              </RadioGroup>
              {form.audience === "SELECTED" && !isSent && (
                <div className="grid gap-1.5">
                  <LearnerPicker
                    learners={learners}
                    loading={learnersLoading}
                    selected={form.recipientIds}
                    onChange={(ids) => set("recipientIds", ids)}
                    invalid={!!errors.recipientIds}
                    describedBy={errors.recipientIds ? "ann-recipients-error" : undefined}
                  />
                  {errors.recipientIds && (
                    <p id="ann-recipients-error" role="alert" className="text-[13px] text-destructive">
                      {errors.recipientIds}
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <div className="grid gap-3 rounded-xl border bg-card p-4">
              <label className="flex items-start justify-between gap-4">
                <span className="flex gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{t("emailLabel")}</span>
                    <span className="text-[13px] text-muted-foreground">{t("emailHint")}</span>
                  </span>
                </span>
                <Switch checked={form.sendEmail} onCheckedChange={(c) => set("sendEmail", c)} disabled={isSent} aria-label={t("emailLabel")} />
              </label>
              <div className="h-px bg-border" />
              <label className="flex items-start justify-between gap-4">
                <span className="flex gap-3">
                  <Pin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{t("pinLabel")}</span>
                    <span className="text-[13px] text-muted-foreground">{t("pinHint")}</span>
                  </span>
                </span>
                <Switch checked={form.pinned} onCheckedChange={(c) => set("pinned", c)} aria-label={t("pinLabel")} />
              </label>
            </div>
          </div>
        </div>
        <SheetFooter className="mt-0 flex-wrap justify-end bg-background">
          {isSent ? (
            <Button onClick={() => submit("update")} loading={pending}>
              {t("saveChanges")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => submit("draft")} disabled={pending} className="mr-auto">
                {t("saveDraft")}
              </Button>
              <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" disabled={pending}>
                    <CalendarClock /> {t("schedule")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-[min(22rem,calc(100vw-2rem))]">
                  <div className="grid gap-3">
                    <Field label={t("scheduleTitle")} htmlFor="ann-schedule" error={errors.scheduledAt} hint={t("scheduleHint", { tz: timeZoneName() })}>
                      <DateTimePicker
                        id="ann-schedule"
                        value={form.scheduledAt}
                        onChange={(iso) => set("scheduledAt", iso)}
                        aria-invalid={errors.scheduledAt ? true : undefined}
                      />
                    </Field>
                    <Button onClick={() => submit("schedule")} loading={save.isPending}>
                      {t("scheduleConfirm")}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={() => submit("send")} loading={saveAndSend.isPending} disabled={pending}>
                <Send /> {t("sendNow")}
              </Button>
            </>
          )}
        </SheetFooter>
      </div>
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={t("sendTitle")}
        description={t("sendText", { count: recipientCount, email: String(form.sendEmail) })}
        confirmLabel={recipientCount > 0 ? t("sendConfirm", { count: recipientCount }) : t("sendNow")}
        loading={saveAndSend.isPending}
        onConfirm={sendNow}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t("discardTitle")}
        description={t("discardText")}
        confirmLabel={t("discard")}
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
