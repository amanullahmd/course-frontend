"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Check, FileText, Hourglass, MessageSquareText, Send, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { LearnItemDto, SubmissionDto } from "@/lib/api/types";
import { dueState, pointsPercent, STATUS_VARIANT } from "@/lib/assignments";
import { cn, formatBytes } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useNow } from "@/hooks/use-now";
import { useUploads } from "@/hooks/use-uploads";
import { useLearnerAssignment, useMySubmissions, useSubmitAssignment } from "@/hooks/queries/practice";
import { isApiError } from "@/lib/api/client";
import { FileTypeIcon } from "@/components/course/file-type-icon";
import { RichContent } from "@/components/course/rich-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FileDropzone, UploadProgressList } from "@/components/ui/file-dropzone";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SubmissionFiles } from "./submission-files";
import type { MediaDto } from "@/lib/api/types";

const STUDENT_ACCEPT = "image/*,audio/*,.pdf,.docx,.odt,.txt";

function StatusBadge({ submission }: { submission: SubmissionDto }) {
  const t = useTranslations("assignments");
  return <Badge variant={STATUS_VARIANT[submission.status]}>{t(`status.${submission.status}`)}</Badge>;
}

function VersionCard({ submission, highlight }: { submission: SubmissionDto; highlight: boolean }) {
  const t = useTranslations("assignments");
  const fmt = useFormat();
  const ref = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);
  const reviewed = submission.status !== "SUBMITTED";
  const percent = pointsPercent(submission.points, submission.maxPoints);
  const own = submission.files.filter((f) => !f.feedbackFile);
  const returned = submission.files.filter((f) => f.feedbackFile);
  return (
    <li
      ref={ref}
      id={`version-${submission.id}`}
      className={cn("scroll-mt-24 rounded-xl border bg-card p-4 shadow-xs", highlight && "ring-2 ring-brand/50")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{t("version", { n: submission.versionNo })}</h3>
        <StatusBadge submission={submission} />
        {submission.late && <Badge variant="warning">{t("late")}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{fmt.dateTime(submission.submittedAt)}</span>
      </div>
      {submission.textAnswer && (
        <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words" lang="de">
          {submission.textAnswer}
        </p>
      )}
      {own.length > 0 && (
        <div className="mt-3">
          <SubmissionFiles files={own} label={t("yourFiles")} />
        </div>
      )}
      {reviewed && (
        <div className="mt-4 rounded-lg border border-brand/25 bg-brand-soft/40 p-4" role="region" aria-label={t("feedbackTitle")}>
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="size-4 text-brand-strong" aria-hidden /> {t("feedbackTitle")}
            </h4>
            {submission.points !== null && (
              <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                <Star className="size-4 text-warning" aria-hidden />
                {t("points", { points: submission.points, max: submission.maxPoints })}
                {percent !== null && <span className="font-normal text-muted-foreground">({percent}%)</span>}
              </span>
            )}
          </div>
          {submission.status === "RETURNED" && <p className="mt-2 text-sm font-medium text-warning">{t("revisionRequested")}</p>}
          {submission.feedback ? (
            <RichContent html={submission.feedback} className="mt-3 text-sm" />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("noWrittenFeedback")}</p>
          )}
          {returned.length > 0 && (
            <div className="mt-3">
              <SubmissionFiles files={returned} label={t("feedbackFiles")} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function SubmitForm({
  item,
  allowText,
  maxFiles,
  initialText,
  onDone,
}: {
  item: LearnItemDto;
  allowText: boolean;
  maxFiles: number;
  initialText: string;
  onDone: () => void;
}) {
  const t = useTranslations("assignments");
  const errorMessage = useErrorMessage();
  const submit = useSubmitAssignment(item.courseId, item.id);
  const [text, setText] = React.useState(initialText);
  const [files, setFiles] = React.useState<MediaDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const { uploads, upload, cancel, retry, dismiss, isUploading } = useUploads({
    onUploaded: (media) => setFiles((list) => (list.length >= maxFiles ? list : [...list, media])),
  });
  const room = maxFiles - files.length - uploads.filter((u) => u.status === "uploading").length;
  const empty = !text.trim() && files.length === 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (empty) return setError(t("emptySubmission"));
    setError(null);
    submit.mutate(
      { textAnswer: text.trim() || null, mediaIds: files.map((f) => f.id) },
      {
        onSuccess: () => {
          toast.success(t("submitted"));
          setFiles([]);
          setText("");
          onDone();
        },
        onError: (err) => setError(isApiError(err) ? (err.fieldErrors.textAnswer ?? err.fieldErrors.mediaIds ?? errorMessage(err)) : errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5" noValidate>
      <h3 className="font-semibold">{t("yourSubmission")}</h3>
      {allowText && (
        <div className="grid gap-2">
          <Label htmlFor="assignment-text">{t("answerText")}</Label>
          <Textarea
            id="assignment-text"
            rows={7}
            value={text}
            maxLength={20000}
            onChange={(e) => setText(e.target.value)}
            lang="de"
            aria-describedby={error ? "assignment-error" : undefined}
          />
        </div>
      )}
      {maxFiles > 0 && (
        <div className="grid gap-2">
          <Label>{t("answerFiles", { max: maxFiles })}</Label>
          {room > 0 && (
            <FileDropzone compact accept={STUDENT_ACCEPT} multiple={room > 1} onFiles={(list) => upload(list.slice(0, room))} hint={t("dropHint")} />
          )}
          <UploadProgressList uploads={uploads} onCancel={cancel} onRetry={retry} onDismiss={dismiss} />
          {files.length > 0 && (
            <ul className="grid gap-2" aria-label={t("yourFiles")}>
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
                  <FileTypeIcon name={f.fileName} contentType={f.contentType} kind={f.kind} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{f.fileName}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} aria-label={t("removeFile", { name: f.fileName })}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p id="assignment-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={submit.isPending} disabled={isUploading || empty}>
          <Send /> {t("submit")}
        </Button>
      </div>
    </form>
  );
}

/** Learner view of an ASSIGNMENT item: rules, the submit form, version history and feedback. */
export function AssignmentView({ item }: { item: LearnItemDto }) {
  const t = useTranslations("assignments");
  const fmt = useFormat();
  const now = useNow();
  const highlight = useSearchParams().get("submission");
  const settings = useLearnerAssignment(item.id);
  const mine = useMySubmissions(item.id);
  const [formKey, setFormKey] = React.useState(0);

  if (settings.isPending || mine.isPending) return <Skeleton className="h-64 rounded-xl" />;
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />;
  const a = settings.data;
  const versions = [...mine.data].sort((x, y) => y.versionNo - x.versionNo);
  const latest = versions[0];
  const due = dueState(a.dueAt, now || Date.now());
  const left = Math.max(0, a.maxSubmissions - a.submissionsUsed);

  return (
    <section aria-labelledby="assignment-heading" className="grid gap-5">
      <h2 id="assignment-heading" className="sr-only">
        {t("heading")}
      </h2>
      <dl className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" aria-hidden /> {t("due")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium">
            {a.dueAt ? fmt.dateTime(a.dueAt) : t("noDeadline")}
            {due === "overdue" && !latest && <Badge variant="destructive" className="ml-2">{t("overdue")}</Badge>}
            {due === "soon" && <Badge variant="warning" className="ml-2">{t("dueSoon")}</Badge>}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="size-3.5" aria-hidden /> {t("maxPoints")}
          </dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums">{a.maxPoints}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" aria-hidden /> {t("rules")}
          </dt>
          <dd className="mt-0.5 text-sm">{a.maxFiles === 0 ? t("noFilesAllowed") : t("filesAllowed", { count: a.maxFiles })}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Send className="size-3.5" aria-hidden /> {t("submissionsLabel")}
          </dt>
          <dd className="mt-0.5 text-sm tabular-nums">{t("submissionsLeft", { used: a.submissionsUsed, max: a.maxSubmissions, left })}</dd>
        </div>
        {a.dueAt && (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">{a.allowLate ? t("lateAllowed") : t("lateNotAllowed")}</p>
        )}
      </dl>

      {a.canSubmit ? (
        <>
          {latest?.status === "RETURNED" && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/60 p-3 text-sm" role="status">
              <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {t("reviseHint")}
            </p>
          )}
          <SubmitForm
            key={`${formKey}-${latest?.id ?? "new"}`}
            item={item}
            allowText={a.allowText}
            maxFiles={a.maxFiles}
            initialText={latest?.status === "RETURNED" ? (latest.textAnswer ?? "") : ""}
            onDone={() => setFormKey((k) => k + 1)}
          />
        </>
      ) : (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            a.submitBlocked === "GRADED" ? "border-success/30 bg-success-soft/50" : "bg-muted/40",
          )}
        >
          {a.submitBlocked === "GRADED" ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Hourglass className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
          {a.submitBlocked ? t(`blocked.${a.submitBlocked}`) : null}
        </p>
      )}

      {versions.length > 0 && (
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">{t("history")}</h3>
          <ol className="grid gap-3">
            {versions.map((v) => (
              <VersionCard key={v.id} submission={v} highlight={highlight === v.id} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
