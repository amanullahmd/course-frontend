"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { MESSAGE_MAX_LENGTH, messagesApi } from "@/lib/api/messages";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useStartConversation } from "@/hooks/queries/messages";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface MessageRecipient {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

/**
 * Opens the existing conversation with `recipient` (in the context of `course`), or a small dialog to write the
 * first message. Permission errors (403) are shown as a toast.
 */
export function MessageButton({
  recipient,
  course,
  label,
  iconOnly = false,
  variant = "outline",
  size = "sm",
  className,
}: {
  recipient: MessageRecipient;
  course?: { id: string; title: string } | null;
  label?: string;
  iconOnly?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [checking, setChecking] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const text = label ?? t("message");

  const onClick = async () => {
    setChecking(true);
    try {
      const existing = await messagesApi.findWith(recipient.id, course?.id);
      router.push(`/messages/${existing.id}`);
    } catch (error) {
      if (isApiError(error) && error.status === 404) setOpen(true);
      else toast.error(errorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? (size === "xs" ? "icon-xs" : "icon-sm") : size}
        className={className}
        onClick={onClick}
        loading={checking}
        aria-label={iconOnly ? t("messageLearner", { name: recipient.fullName }) : undefined}
        title={iconOnly ? t("messageLearner", { name: recipient.fullName }) : undefined}
      >
        {!checking && <MessageSquare />}
        {!iconOnly && text}
      </Button>
      <NewMessageDialog open={open} onOpenChange={setOpen} recipient={recipient} course={course ?? null} />
    </>
  );
}

function NewMessageDialog({
  open,
  onOpenChange,
  recipient,
  course,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: MessageRecipient;
  course: { id: string; title: string } | null;
}) {
  const t = useTranslations("messaging");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const start = useStartConversation();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const firstName = recipient.fullName.split(" ")[0] ?? recipient.fullName;
  const tooLong = body.length > MESSAGE_MAX_LENGTH;

  const submit = () => {
    if (!body.trim() || tooLong) return;
    setError(null);
    start.mutate(
      { recipientId: recipient.id, courseId: course?.id ?? null, body: body.trim() },
      {
        onSuccess: (conversation) => {
          toast.success(t("startedToast"));
          onOpenChange(false);
          setBody("");
          router.push(`/messages/${conversation.id}`);
        },
        onError: (e) => setError(isApiError(e) && e.status === 429 ? t("rateLimited") : errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <UserAvatar name={recipient.fullName} src={recipient.avatarUrl} className="size-10" />
            <div className="min-w-0">
              <DialogTitle className="truncate">{t("dialogTitle", { name: recipient.fullName })}</DialogTitle>
              <DialogDescription>{t("dialogDescription", { course: course?.title ?? "none" })}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            placeholder={t("dialogPlaceholder", { name: firstName })}
            aria-label={t("composerLabel", { name: recipient.fullName })}
            aria-invalid={tooLong || undefined}
            rows={5}
            className="max-h-[50vh] resize-y"
            autoFocus
          />
          <div className="flex items-start justify-between gap-3 text-xs">
            <p role="alert" className="text-destructive">
              {error ?? (tooLong ? t("tooLong", { max: MESSAGE_MAX_LENGTH }) : "")}
            </p>
            <span className={cn("shrink-0 tabular-nums text-muted-foreground", tooLong && "text-destructive")}>
              {t("counter", { count: body.length, max: MESSAGE_MAX_LENGTH })}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={start.isPending}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} loading={start.isPending} disabled={!body.trim() || tooLong}>
            {t("dialogSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Message" action for a learner row in the instructor's Students tab (any enrollment status may be messaged). */
export function MessageLearnerButton({
  student,
  course,
  iconOnly = false,
  size = "xs",
  className,
}: {
  student: MessageRecipient;
  course: { id: string; title: string };
  iconOnly?: boolean;
  size?: ButtonProps["size"];
  className?: string;
}) {
  return <MessageButton recipient={student} course={course} iconOnly={iconOnly} size={size} variant="outline" className={className} />;
}

/** "Message instructor" for approved or pending learners (course player sidebar, course page). */
export function MessageInstructorButton({
  instructor,
  course,
  className,
  size = "sm",
  variant = "outline",
}: {
  instructor: MessageRecipient;
  course: { id: string; title: string };
  className?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const t = useTranslations("messaging");
  return <MessageButton recipient={instructor} course={course} label={t("messageInstructor")} className={className} size={size} variant={variant} />;
}
