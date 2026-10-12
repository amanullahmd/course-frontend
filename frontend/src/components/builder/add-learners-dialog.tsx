"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, MailPlus, Send, UserRoundX, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AddStudentsResult } from "@/lib/api/types";
import { useAddStudents } from "@/hooks/queries/instructor";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const MAX_ADD_EMAILS = 200;
const EMAIL = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;

type Token = { value: string; key: string; valid: boolean; duplicate: boolean };

/** Splits on commas, semicolons, whitespace; strips `<…>` and quotes (pasted "Name <a@b.de>" lists). */
export function parseEmails(text: string): Token[] {
  const seen = new Set<string>();
  return text
    .split(/[\s,;]+/)
    .map((raw) => raw.replace(/^[<"'(]+|[>"')]+$/g, ""))
    .filter(Boolean)
    .map((value) => {
      const key = value.toLowerCase();
      const duplicate = seen.has(key);
      seen.add(key);
      return { value, key, valid: value.length <= 254 && EMAIL.test(value), duplicate };
    });
}

export function AddLearnersDialog({
  courseId,
  open,
  onOpenChange,
  seatsLeft,
}: {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = unlimited */
  seatsLeft: number | null;
}) {
  const t = useTranslations("addLearners");
  const tc = useTranslations("common");
  const add = useAddStudents(courseId);
  const [text, setText] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [invite, setInvite] = React.useState(false);
  const [result, setResult] = React.useState<AddStudentsResult | null>(null);

  const tokens = React.useMemo(() => parseEmails(text), [text]);
  const unique = tokens.filter((x) => !x.duplicate);
  const invalid = unique.filter((x) => !x.valid);
  const duplicates = tokens.length - unique.length;
  const valid = unique.filter((x) => x.valid);
  const tooMany = unique.length > MAX_ADD_EMAILS;
  const canSubmit = valid.length > 0 && invalid.length === 0 && !tooMany;

  const reset = () => {
    setText("");
    setMessage("");
    setInvite(false);
    setResult(null);
    add.reset();
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) window.setTimeout(reset, 200); // after the closing animation
  };

  const removeToken = (key: string) =>
    setText(
      tokens
        .filter((x) => x.key !== key)
        .map((x) => x.value)
        .join(", "),
    );

  const submit = () => {
    if (!canSubmit) return;
    add.mutate(
      { emails: valid.map((x) => x.value), message: message.trim() || null, invite },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(t("toast", { count: r.added.length }));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>{result ? t("resultsTitle") : t("title")}</DialogTitle>
          <DialogDescription>{result ? t("resultsSummary", { added: result.added.length }) : t("description")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <Results result={result} invite={invite} />
        ) : (
          <form
            id="add-learners-form"
            className="grid min-w-0 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="add-emails">{t("emailsLabel")}</Label>
              <Textarea
                id="add-emails"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("emailsPlaceholder")}
                aria-describedby="add-emails-hint add-emails-count"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoFocus
              />
              <p id="add-emails-hint" className="text-xs text-muted-foreground">
                {t("emailsHint", { max: MAX_ADD_EMAILS })}
              </p>
              {unique.length > 0 && (
                <ul className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto" aria-label={t("emailsLabel")}>
                  {unique.map((x) => (
                    <li
                      key={x.key}
                      title={x.valid ? undefined : t("invalidChip")}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-xs ring-1 ring-inset",
                        x.valid ? "bg-secondary text-secondary-foreground ring-border" : "bg-destructive-soft text-destructive ring-destructive/30",
                      )}
                    >
                      {!x.valid && <CircleAlert className="size-3 shrink-0" aria-hidden />}
                      <span className="truncate">{x.value}</span>
                      {!x.valid && <span className="sr-only">({t("invalidChip")})</span>}
                      <button
                        type="button"
                        onClick={() => removeToken(x.key)}
                        className="grid size-5 shrink-0 place-items-center rounded hover:bg-foreground/10"
                        aria-label={t("removeEmail", { email: x.value })}
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div id="add-emails-count" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" aria-live="polite">
                <span className="font-medium tabular-nums">{t("count", { count: valid.length })}</span>
                {invalid.length > 0 && <span className="text-destructive">{t("invalidCount", { count: invalid.length })}</span>}
                {duplicates > 0 && <span className="text-muted-foreground">{t("duplicateCount", { count: duplicates })}</span>}
                {tokens.length > 0 && (
                  <button type="button" className="ml-auto text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => setText("")}>
                    {t("clearAll")}
                  </button>
                )}
              </div>
              {tooMany && <p className="text-xs text-destructive">{t("tooMany", { max: MAX_ADD_EMAILS, count: unique.length - MAX_ADD_EMAILS })}</p>}
              {seatsLeft != null && valid.length > seatsLeft && (
                <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">{t("seatsHint", { count: Math.max(0, seatsLeft) })}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="add-message">
                {t("messageLabel")} <span className="font-normal text-muted-foreground">{t("messageHint")}</span>
              </Label>
              <Textarea
                id="add-message"
                rows={2}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
              />
            </div>

            <label htmlFor="add-invite" className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-accent/40">
              <Checkbox id="add-invite" checked={invite} onCheckedChange={(c) => setInvite(c === true)} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{t("invite")}</span>
                <span className="text-xs text-muted-foreground">{t("inviteHint")}</span>
              </span>
            </label>
          </form>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>
                <MailPlus /> {t("addMore")}
              </Button>
              <Button onClick={() => close(false)}>{t("done")}</Button>
            </>
          ) : (
            <>
              {invalid.length > 0 && <p className="text-xs text-destructive sm:mr-auto sm:self-center">{t("fixInvalid")}</p>}
              <Button variant="outline" onClick={() => close(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" form="add-learners-form" loading={add.isPending} disabled={!canSubmit}>
                <MailPlus /> {t("submit", { count: valid.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Results({ result, invite }: { result: AddStudentsResult; invite: boolean }) {
  const t = useTranslations("addLearners");
  const invited = new Set(result.invited);
  const notInvited = result.notFound.filter((e) => !invited.has(e));
  const reason = (code: string) => {
    const key = `reasons.${code}` as "reasons.other";
    return t.has(key) ? t(key) : t("reasons.other");
  };
  return (
    <div className="grid min-w-0 gap-3">
      <Section icon={CircleCheck} tone="success" title={t("added")} count={result.added.length}>
        {result.added.map((e) => (
          <li key={e.id} className="flex min-w-0 items-center gap-2.5 py-1">
            <UserAvatar name={e.student.fullName} src={e.student.avatarUrl} className="size-7" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{e.student.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{e.student.email}</span>
            </span>
          </li>
        ))}
      </Section>
      <Section icon={UserRoundX} tone="muted" title={t("alreadyEnrolled")} count={result.alreadyEnrolled.length}>
        {result.alreadyEnrolled.map((e) => (
          <EmailRow key={e} email={e} />
        ))}
      </Section>
      <Section icon={Send} tone="info" title={t("invited")} count={result.invited.length}>
        {result.invited.map((e) => (
          <EmailRow key={e} email={e} />
        ))}
      </Section>
      <Section icon={UserX} tone="warning" title={t("notFound")} count={notInvited.length} hint={!invite ? t("notFoundHint") : undefined}>
        {notInvited.map((e) => (
          <EmailRow key={e} email={e} />
        ))}
      </Section>
      <Section icon={CircleAlert} tone="destructive" title={t("skipped")} count={result.skipped.length}>
        {result.skipped.map((s) => (
          <EmailRow key={s.email + s.code} email={s.email} note={reason(s.code)} />
        ))}
      </Section>
    </div>
  );
}

const TONES = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
} as const;

function Section({
  icon: Icon,
  tone,
  title,
  count,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  title: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="min-w-0 rounded-xl border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("size-4", TONES[tone])} />
        {title}
        <span className="ml-auto rounded-md bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
      </h3>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <ul className="mt-1.5 grid max-h-40 gap-0.5 overflow-y-auto">{children}</ul>
    </section>
  );
}

function EmailRow({ email, note }: { email: string; note?: string }) {
  return (
    <li className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 py-0.5 text-sm">
      <span className="min-w-0 truncate">{email}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </li>
  );
}
