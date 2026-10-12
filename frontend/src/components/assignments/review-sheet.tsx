"use client";

import * as React from "react";
import { Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { MediaDto, SubmissionDetailDto, SubmissionDto } from "@/lib/api/types";
import { isApiError } from "@/lib/api/client";
import { parsePoints, pointsProblem, STATUS_VARIANT } from "@/lib/assignments";
import { cn, formatBytes } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useUploads } from "@/hooks/use-uploads";
import { useReviewSubmission, useSubmissionDetail } from "@/hooks/queries/practice";
import { RichContent } from "@/components/course/rich-content";
import { FileTypeIcon } from "@/components/course/file-type-icon";
import { RichTextEditor } from "@/components/builder/rich-text-editor";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FileDropzone, UploadProgressList } from "@/components/ui/file-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionFiles } from "./submission-files";

function VersionBody({ version }: { version: SubmissionDto }) {
  const t = useTranslations("assignments");
  const own = version.files.filter((f) => !f.feedbackFile);
  const returned = version.files.filter((f) => f.feedbackFile);
  const reviewed = version.status !== "SUBMITTED";
  return (
    <div className="grid gap-4">
      {version.textAnswer ? (
        <section aria-label={t("answerText")}>
          <h3 className="mb-1.5 text-sm font-semibold">{t("answerText")}</h3>
          <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words" lang="de">
            {version.textAnswer}
          </p>
        </section>
      ) : null}
      {own.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-sm font-semibold">{t("filesOfLearner", { count: own.length })}</h3>
          <SubmissionFiles files={own} label={t("filesOfLearner", { count: own.length })} />
        </section>
      )}
      {!version.textAnswer && own.length === 0 && <p className="text-sm text-muted-foreground">{t("nothingSubmitted")}</p>}
      {reviewed && (
        <section className="rounded-lg border border-brand/25 bg-brand-soft/40 p-3" aria-label={t("feedbackTitle")}>
          <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
            {t("feedbackTitle")}
            {version.points !== null && <span className="tabular-nums">{t("points", { points: version.points, max: version.maxPoints })}</span>}
          </h3>
          {version.feedback ? <RichContent html={version.feedback} className="mt-2 text-sm" /> : <p className="mt-1 text-sm text-muted-foreground">{t("noWrittenFeedback")}</p>}
          {returned.length > 0 && (
            <div className="mt-2">
              <SubmissionFiles files={returned} label={t("feedbackFiles")} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ReviewForm({ detail, onDone }: { detail: SubmissionDetailDto; onDone: () => void }) {
  const t = useTranslations("assignments");
  const errorMessage = useErrorMessage();
  const review = useReviewSubmission(detail.summary.id);
  const max = detail.assignment.maxPoints;
  const cur = detail.current;
  const [points, setPoints] = React.useState(cur.points !== null ? String(cur.points) : "");
  const [feedback, setFeedback] = React.useState(cur.feedback ?? "");
  const [files, setFiles] = React.useState<MediaDto[]>(cur.files.filter((f) => f.feedbackFile).map((f) => f.media));
  const [errors, setErrors] = React.useState<{ points?: string; feedback?: string }>({});
  const { uploads, upload, cancel, retry, dismiss, isUploading } = useUploads({
    onUploaded: (media) => setFiles((list) => (list.length >= 10 ? list : [...list, media])),
  });

  const submit = (action: "RETURN" | "GRADE") => {
    const next: { points?: string; feedback?: string } = {};
    const problem = pointsProblem(points, max, action === "GRADE");
    if (problem === "missing") next.points = t("pointsMissing");
    if (problem === "range") next.points = t("pointsRange", { max });
    const plain = feedback.replace(/<[^>]*>/g, "").trim();
    if (action === "RETURN" && !plain && files.length === 0) next.feedback = t("feedbackRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    review.mutate(
      { action, points: parsePoints(points), feedback: plain ? feedback : null, feedbackMediaIds: files.map((f) => f.id) },
      {
        onSuccess: () => {
          toast.success(action === "GRADE" ? t("graded") : t("returned"));
          onDone();
        },
        onError: (err) => {
          if (isApiError(err) && (err.fieldErrors.points || err.fieldErrors.feedback)) {
            setErrors({ points: err.fieldErrors.points, feedback: err.fieldErrors.feedback });
          } else toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <form
      className="grid gap-4 border-t bg-muted/20 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit("GRADE");
      }}
      noValidate
    >
      <h3 className="font-semibold">{t("yourReview")}</h3>
      <div className="grid max-w-48 gap-2">
        <Label htmlFor="review-points">{t("pointsOf", { max })}</Label>
        <Input
          id="review-points"
          inputMode="decimal"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          aria-invalid={!!errors.points || undefined}
          aria-describedby={errors.points ? "review-points-error" : undefined}
        />
        {errors.points && (
          <p id="review-points-error" role="alert" className="text-[13px] text-destructive">
            {errors.points}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label>{t("feedbackLabel")}</Label>
        <RichTextEditor value={feedback} onChange={setFeedback} placeholder={t("feedbackPlaceholder")} />
        {errors.feedback && (
          <p role="alert" className="text-[13px] text-destructive">
            {errors.feedback}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label>{t("feedbackFilesLabel")}</Label>
        <FileDropzone compact onFiles={(list) => upload(list.slice(0, Math.max(0, 10 - files.length)))} hint={t("feedbackFilesHint")} />
        <UploadProgressList uploads={uploads} onCancel={cancel} onRetry={retry} onDismiss={dismiss} />
        {files.length > 0 && (
          <ul className="grid gap-2" aria-label={t("feedbackFiles")}>
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                <FileTypeIcon name={f.fileName} contentType={f.contentType} kind={f.kind} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{f.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
                </span>
                <Button type="button" variant="ghost" size="xs" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))}>
                  {t("removeFileShort")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => submit("RETURN")} loading={review.isPending && review.variables?.action === "RETURN"} disabled={isUploading || review.isPending}>
          <Undo2 /> {t("returnForRevision")}
        </Button>
        <Button type="submit" loading={review.isPending && review.variables?.action === "GRADE"} disabled={isUploading || review.isPending}>
          <Check /> {detail.current.status === "GRADED" ? t("updateGrade") : t("grade")}
        </Button>
      </div>
    </form>
  );
}

function SheetBody({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("assignments");
  const fmt = useFormat();
  const detail = useSubmissionDetail(id);
  const [picked, setPicked] = React.useState<string | null>(null);

  if (detail.isPending) {
    return (
      <div className="grid gap-3 p-5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className="p-5">
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </div>
    );
  }
  const d = detail.data;
  const shown = d.history.find((h) => h.id === (picked ?? d.current.id)) ?? d.current;
  const isCurrent = shown.id === d.current.id;
  const canReview = isCurrent && d.latest && d.current.status !== "RETURNED";
  return (
    <>
      <SheetHeader className="gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={d.summary.student.fullName} src={d.summary.student.avatarUrl} className="size-10" />
          <div className="min-w-0">
            <SheetTitle className="truncate">{d.summary.student.fullName}</SheetTitle>
            <SheetDescription className="truncate">{d.summary.itemTitle}</SheetDescription>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant={STATUS_VARIANT[shown.status]}>{t(`status.${shown.status}`)}</Badge>
          {shown.late && <Badge variant="warning">{t("late")}</Badge>}
          <span>{t("submittedOn", { date: fmt.dateTime(shown.submittedAt) })}</span>
        </p>
        {d.history.length > 1 && (
          <div className="overflow-x-auto">
            <Segmented
              aria-label={t("versions")}
              value={shown.id}
              onChange={setPicked}
              options={d.history.map((h) => ({ value: h.id, label: t("versionShort", { n: h.versionNo }) }))}
            />
          </div>
        )}
      </SheetHeader>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", !canReview && "pb-5")}>
        <div className="p-5">
          <VersionBody version={shown} />
        </div>
        {isCurrent && d.current.status === "RETURNED" && d.latest && (
          <p className="mx-5 mb-5 rounded-lg border border-warning/40 bg-warning-soft/60 p-3 text-sm" role="status">
            {t("waitingForRevision")}
          </p>
        )}
        {!isCurrent && <p className="mx-5 mb-5 text-xs text-muted-foreground">{t("olderVersion")}</p>}
        {canReview && <ReviewForm key={d.current.id + d.current.status} detail={d} onDone={onClose} />}
      </div>
    </>
  );
}

/** Review drawer of one submission: text and files, version history, points, rich-text feedback, Return / Grade. */
export function ReviewSheet({ submissionId, onClose }: { submissionId: string | null; onClose: () => void }) {
  const t = useTranslations("assignments");
  return (
    <Sheet open={!!submissionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[min(100vw,44rem)] gap-0" aria-describedby={undefined}>
        {submissionId ? (
          <SheetBody key={submissionId} id={submissionId} onClose={onClose} />
        ) : (
          <SheetTitle className="sr-only">{t("reviewTitle")}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
