"use client";

import * as React from "react";
import { Check, Hourglass, Inbox, MessageSquareText, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { AttemptAnswerResult, AttemptResultDto } from "@/lib/api/types";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useGradeAttempt, useInstructorAttempt, useItemAttempts } from "@/hooks/queries/instructor";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AnswerDetail, AnswerPrompt, isLanguageType } from "@/components/quiz/answer-detail";

const needsGrading = (a: AttemptAnswerResult) => a.type === "ESSAY" || a.type === "SPEAKING" || a.pointsAwarded == null;

type Grades = Record<string, { points: string; feedback: string }>;

function initialGrades(result: AttemptResultDto): Grades {
  const g: Grades = {};
  for (const a of result.answers) {
    if (needsGrading(a)) g[a.questionId] = { points: a.pointsAwarded != null ? String(a.pointsAwarded) : "", feedback: a.feedback ?? "" };
  }
  return g;
}

function GradingForm({ result, itemId, onDone }: { result: AttemptResultDto; itemId: string; onDone: () => void }) {
  const t = useTranslations();
  const fmt = useFormat();
  const grade = useGradeAttempt(itemId);
  const [grades, setGrades] = React.useState<Grades>(() => initialGrades(result));
  const gradable = result.answers.filter(needsGrading);
  const invalid = gradable.some((a) => {
    const v = grades[a.questionId]?.points;
    return v === "" || v === undefined || Number(v) < 0 || Number(v) > a.points;
  });

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mb-5 flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <UserAvatar name={result.student.fullName} src={result.student.avatarUrl} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{result.student.fullName}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {t("submissions.submittedOn", { date: fmt.dateTime(result.submittedAt) })}
              {result.late && <Badge variant="warning">{t("submissions.late")}</Badge>}
              {result.autoSubmitted && <Badge variant="info">{t("submissions.autoSubmitted")}</Badge>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{result.percent != null ? `${Math.round(result.percent)}%` : "–"}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("submissions.ptsSummary", { score: result.score ?? 0, max: result.maxScore ?? 0 })}
            </p>
          </div>
        </div>
        <ol className="grid gap-4">
          {result.answers.map((a, i) => {
            const editable = needsGrading(a);
            const g = grades[a.questionId];
            return (
              <li key={a.questionId} className={cn("rounded-xl border p-4", editable && "border-brand/40 bg-brand-soft/20")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t("submissions.questionHeader", { n: i + 1, type: t(`questionTypes.${a.type}.label`), points: a.points })}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      <AnswerPrompt answer={a} />
                    </p>
                  </div>
                  {!editable &&
                    (a.correct ? (
                      <Badge variant="success">
                        <Check /> {a.pointsAwarded ?? a.points}
                      </Badge>
                    ) : (a.pointsAwarded ?? 0) > 0 ? (
                      <Badge variant="warning">{a.pointsAwarded}</Badge>
                    ) : (
                      <Badge variant="destructive">
                        <X /> {a.pointsAwarded ?? 0}
                      </Badge>
                    ))}
                </div>
                {isLanguageType(a.type) && <AnswerDetail answer={a} />}
                <div className={cn("mt-3 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border", isLanguageType(a.type) && "hidden")}>
                  {a.options && a.options.length > 0 && !isLanguageType(a.type) ? (
                    <ul className="grid gap-1">
                      {a.options.map((o) => (
                        <li key={o.id} className={cn("flex items-center gap-2", a.selectedOptionIds.includes(o.id) ? "font-medium" : "text-muted-foreground")}>
                          <span className={cn("size-2 rounded-full", a.selectedOptionIds.includes(o.id) ? "bg-foreground" : "bg-border")} />
                          {o.text}
                          {o.correct && <Check className="size-3.5 text-success" />}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="whitespace-pre-line">{a.textAnswer?.trim() || <em className="text-muted-foreground">{t("submissions.noAnswer")}</em>}</p>
                  )}
                </div>
                {editable && g && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`pts-${a.questionId}`}>{t("submissions.points")}</Label>
                      <div className="relative">
                        <Input
                          id={`pts-${a.questionId}`}
                          type="number"
                          min={0}
                          max={a.points}
                          step={0.5}
                          value={g.points}
                          onChange={(e) => setGrades({ ...grades, [a.questionId]: { ...g, points: e.target.value } })}
                          className="pr-10"
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">/{a.points}</span>
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`fb-${a.questionId}`} className="flex items-center gap-1.5">
                        <MessageSquareText className="size-3.5" /> {t("submissions.feedback")}
                      </Label>
                      <Textarea
                        id={`fb-${a.questionId}`}
                        rows={3}
                        value={g.feedback}
                        lang="de"
                        onChange={(e) => setGrades({ ...grades, [a.questionId]: { ...g, feedback: e.target.value } })}
                        placeholder={t("submissions.feedbackPlaceholder")}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <SheetFooter>
        <Button variant="outline" onClick={onDone}>
          {t("common.close")}
        </Button>
        {gradable.length > 0 && (
          <Button
            className="ml-auto"
            disabled={invalid}
            loading={grade.isPending}
            onClick={() =>
              grade.mutate(
                {
                  attemptId: result.id,
                  body: {
                    grades: gradable.map((a) => ({
                      questionId: a.questionId,
                      pointsAwarded: Number(grades[a.questionId].points),
                      feedback: grades[a.questionId].feedback.trim() || null,
                    })),
                  },
                },
                {
                  onSuccess: () => {
                    toast.success(t("submissions.gradesSaved"));
                    onDone();
                  },
                },
              )
            }
          >
            {t("submissions.saveGrades")}
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

function GradingSheet({ attemptId, itemId, onClose }: { attemptId: string | null; itemId: string; onClose: () => void }) {
  const t = useTranslations("submissions");
  const attempt = useInstructorAttempt(attemptId);
  return (
    <Sheet open={!!attemptId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[min(100vw-1rem,40rem)] gap-0 p-0">
        <SheetHeader className="mb-4">
          <SheetTitle>{t("reviewTitle")}</SheetTitle>
          <SheetDescription>{t("reviewText")}</SheetDescription>
        </SheetHeader>
        {attempt.isPending ? (
          <div className="grid gap-3 px-5">
            <Skeleton className="h-16" />
            <Skeleton className="h-40" />
          </div>
        ) : attempt.isError ? (
          <ErrorState className="mx-5" error={attempt.error} onRetry={() => attempt.refetch()} />
        ) : (
          <GradingForm key={attempt.data.id + attempt.dataUpdatedAt} result={attempt.data} itemId={itemId} onDone={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SubmissionsPanel({ itemId, initialAttemptId = null }: { itemId: string; initialAttemptId?: string | null }) {
  const t = useTranslations("submissions");
  const tq = useTranslations("quiz");
  const fmt = useFormat();
  const attempts = useItemAttempts(itemId);
  const [open, setOpen] = React.useState<string | null>(initialAttemptId);
  const [filter, setFilter] = React.useState<"all" | "pending">("all");
  const list = (attempts.data ?? []).filter((a) => a.status !== "IN_PROGRESS" && (filter === "all" || a.pendingManualGrading));
  const pendingCount = (attempts.data ?? []).filter((a) => a.pendingManualGrading).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pendingCount > 0 ? t("pending", { count: pendingCount }) : t("allGraded")}
        </p>
        <Segmented
          aria-label={t("filter")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("all") },
            { value: "pending", label: pendingCount ? t("needsGradingCount", { count: pendingCount }) : t("needsGrading") },
          ]}
        />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {attempts.isPending ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : attempts.isError ? (
          <ErrorState className="m-4" error={attempts.error} onRetry={() => attempts.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState className="m-4 border-none" icon={Inbox} title={filter === "pending" ? t("nothingToGrade") : t("noSubmissions")} description={t("appearHere")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("learner")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("submitted")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("status")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("score")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={a.student.fullName} src={a.student.avatarUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.student.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.student.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 sm:hidden">
                      {a.percent != null && <span className="text-sm font-medium tabular-nums">{Math.round(a.percent)}%</span>}
                      {a.pendingManualGrading ? (
                        <Badge variant="info">
                          <Hourglass /> {t("needsGrading")}
                        </Badge>
                      ) : a.passed ? (
                        <Badge variant="success">{tq("passed")}</Badge>
                      ) : (
                        <Badge variant="destructive">{tq("notPassed")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                    {fmt.dateTime(a.submittedAt)}
                    {(a.late || a.autoSubmitted) && (
                      <span className="mt-1 flex gap-1">
                        {a.late && <Badge variant="warning">{t("late")}</Badge>}
                        {a.autoSubmitted && <Badge variant="info">{t("autoSubmitted")}</Badge>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {a.pendingManualGrading ? (
                      <Badge variant="info">
                        <Hourglass /> {t("needsGrading")}
                      </Badge>
                    ) : a.passed ? (
                      <Badge variant="success">{tq("passed")}</Badge>
                    ) : (
                      <Badge variant="destructive">{tq("notPassed")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">{a.percent != null ? `${Math.round(a.percent)}%` : "–"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant={a.pendingManualGrading ? "default" : "ghost"} onClick={() => setOpen(a.id)}>
                      {a.pendingManualGrading ? t("grade") : t("view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <GradingSheet attemptId={open} itemId={itemId} onClose={() => setOpen(null)} />
    </div>
  );
}
