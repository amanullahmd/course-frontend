"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CloudOff, Flag, Loader2, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import type { AttemptResultDto, AttemptSessionDto, SubmitAnswer } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { useSubmitAttempt } from "@/hooks/queries/student";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { draftFromSaved, normalizeDraft, toSubmitAnswer } from "@/lib/exercises";
import { usePendingUploads } from "@/lib/upload-tracker";
import { emptyAnswer, isAnswered, QuestionInput, QuestionMedia, QuestionPrompt, type DraftAnswer } from "./question-input";

type Answers = Record<string, DraftAnswer>;

/** Local fallback copy of the draft; {@code pending} = changes the server has not confirmed yet. */
interface StoredDraft {
  answers: Answers;
  pending: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_INTERVAL_MS = 20_000;
const SUBMIT_RETRY_MS = 5000;

function readStored(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft | Answers;
    // older versions stored the plain answers map
    if (parsed && typeof parsed === "object" && "answers" in parsed && typeof parsed.pending === "boolean") return parsed as StoredDraft;
    return { answers: parsed as Answers, pending: true };
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function removeStored(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Server drafts, overlaid with local changes the server never confirmed (e.g. saved while offline). */
function initialAnswers(session: AttemptSessionDto, key: string): { answers: Answers; pending: boolean } {
  const server: Answers = {};
  for (const a of session.savedAnswers ?? []) {
    server[a.questionId] = draftFromSaved(a);
  }
  const local = typeof window === "undefined" ? null : readStored(key);
  if (local) local.answers = Object.fromEntries(Object.entries(local.answers).map(([id, a]) => [id, normalizeDraft(a)]));
  if (local?.pending) return { answers: { ...server, ...local.answers }, pending: true };
  if (local && Object.keys(server).length === 0) return { answers: local.answers, pending: Object.keys(local.answers).length > 0 };
  return { answers: server, pending: false };
}

function toPayload(questions: AttemptSessionDto["questions"], answers: Answers): SubmitAnswer[] {
  return questions.map((x) => toSubmitAnswer(x, answers[x.id]));
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Countdown({ deadline, offset, onExpire }: { deadline: string; offset: number; onExpire: () => void }) {
  const t = useTranslations("quiz");
  const now = useNow();
  const end = React.useMemo(() => new Date(deadline).getTime(), [deadline]);
  const remaining = now ? end - (now + offset) : Number.POSITIVE_INFINITY;
  const fired = React.useRef(false);
  const onExpireRef = React.useRef(onExpire);
  React.useEffect(() => {
    onExpireRef.current = onExpire;
  });
  React.useEffect(() => {
    if (remaining <= 0 && !fired.current) {
      fired.current = true;
      onExpireRef.current();
    }
  }, [remaining]);
  const urgent = remaining < 60_000;
  const warn = remaining < 5 * 60_000;
  return (
    <div
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      aria-label={t("timer")}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm font-semibold tabular-nums transition-colors",
        urgent ? "animate-pulse border-destructive/40 bg-destructive-soft text-destructive" : warn ? "border-warning/40 bg-warning-soft text-warning" : "bg-card",
      )}
    >
      <Timer className="size-4" />
      {Number.isFinite(remaining) ? formatRemaining(remaining) : "--:--"}
    </div>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "offline" };

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("quiz");
  const fmt = useFormat();
  if (state.kind === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1" aria-live="polite">
      {state.kind === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" /> {t("saving")}
        </>
      )}
      {state.kind === "saved" && (
        <>
          <Check className="size-3 text-success" /> {t("savedAt", { time: fmt.date(state.at, "HH:mm") })}
        </>
      )}
      {state.kind === "offline" && (
        <span className="inline-flex items-center gap-1 text-warning">
          <CloudOff className="size-3" /> {t("savedOffline")}
        </span>
      )}
    </span>
  );
}

export function QuizPlayer({
  session,
  itemId,
  courseId,
  title,
  onSubmitted,
}: {
  session: AttemptSessionDto;
  itemId: string;
  courseId: string;
  title: string;
  onSubmitted: (result: AttemptResultDto) => void;
}) {
  const t = useTranslations("quiz");
  const tc = useTranslations("common");
  const fmt = useFormat();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const storageKey = `sw.attempt.${session.id}`;
  const [initial] = React.useState(() => initialAnswers(session, storageKey));
  const [answers, setAnswersState] = React.useState<Answers>(initial.answers);
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [index, setIndex] = React.useState(0);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "idle" });
  const [finishing, setFinishing] = React.useState(false);
  const submit = useSubmitAttempt(itemId, courseId);
  const uploads = usePendingUploads();
  const te = useTranslations("exercises.recorder");
  const questions = session.questions;
  const q = questions[index];
  const answeredCount = questions.filter((x) => isAnswered(x, answers[x.id])).length;
  const unanswered = questions.length - answeredCount;
  // Server clock minus client clock, so the countdown matches the server's deadline even with a skewed device clock.
  const [offset] = React.useState(() => (session.serverTime ? new Date(session.serverTime).getTime() - Date.now() : 0));
  const timeLimitCapped =
    !!session.deadline &&
    !!session.availableUntil &&
    !!session.timeLimitMinutes &&
    new Date(session.deadline).getTime() === new Date(session.availableUntil).getTime() &&
    new Date(session.startedAt).getTime() + session.timeLimitMinutes * 60_000 > new Date(session.availableUntil).getTime();

  // ---- autosave bookkeeping (refs: read by timers and page-lifecycle listeners) ----
  const answersRef = React.useRef(answers);
  const versionRef = React.useRef(initial.pending ? 1 : 0);
  const savedVersionRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const doneRef = React.useRef(false);
  const submittingRef = React.useRef(false);
  // latest callbacks for timers that re-schedule themselves
  const saveRef = React.useRef<((keepalive?: boolean) => Promise<void>) | null>(null);
  const doSubmitRef = React.useRef<((auto?: boolean, retry?: number) => void) | null>(null);
  const mountedRef = React.useRef(true);
  // The parent re-renders every second (countdowns) with a new callback; keep autosave timers stable.
  const onSubmittedRef = React.useRef(onSubmitted);
  const errorMessageRef = React.useRef(errorMessage);
  React.useEffect(() => {
    onSubmittedRef.current = onSubmitted;
    errorMessageRef.current = errorMessage;
  });
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const finish = React.useCallback(
    (result: AttemptResultDto, auto: boolean) => {
      if (!mountedRef.current) return;
      doneRef.current = true;
      removeStored(storageKey);
      qc.setQueryData(qk.student.attempt(result.id), result);
      void qc.invalidateQueries({ queryKey: qk.student.attempts(itemId) });
      void qc.invalidateQueries({ queryKey: qk.student.item(itemId) });
      void qc.invalidateQueries({ queryKey: qk.student.learn(courseId) });
      if (result.autoSubmitted) toast.info(t("autoSubmittedToast"));
      else if (auto) toast.info(t("timeUp"));
      else if (result.pendingManualGrading || result.status === "SUBMITTED") toast.success(t("submittedPending"));
      else if (result.passed) toast.success(t("submittedPassed"));
      else toast.success(t("submittedNeutral"));
      onSubmittedRef.current(result);
    },
    [courseId, itemId, qc, storageKey, t],
  );

  /** The server already closed the attempt (expired or submitted elsewhere): show its result. */
  const showServerResult = React.useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      finish(await studentApi.attempt(session.id), false);
    } catch (error) {
      doneRef.current = false;
      toast.error(errorMessageRef.current(error));
    }
  }, [finish, session.id]);

  const save = React.useCallback(
    async (keepalive = false) => {
      if (doneRef.current || versionRef.current === savedVersionRef.current) return;
      if (inFlightRef.current && !keepalive) return;
      const version = versionRef.current;
      inFlightRef.current = true;
      if (!keepalive) setSaveState({ kind: "saving" });
      try {
        await studentApi.saveAnswers(session.id, { answers: toPayload(questions, answersRef.current) }, { keepalive });
        savedVersionRef.current = Math.max(savedVersionRef.current, version);
        if (versionRef.current === version) writeStored(storageKey, { answers: answersRef.current, pending: false });
        if (mountedRef.current) setSaveState({ kind: "saved", at: new Date() });
      } catch (error) {
        if (isApiError(error) && (error.code === "ATTEMPT_EXPIRED" || error.code === "ATTEMPT_ALREADY_SUBMITTED")) {
          void showServerResult();
        } else if (mountedRef.current) {
          setSaveState({ kind: "offline" });
        }
      } finally {
        inFlightRef.current = false;
      }
      // changes made while this request was running
      if (mountedRef.current && !keepalive && versionRef.current !== savedVersionRef.current && !doneRef.current) {
        setTimeout(() => void saveRef.current?.(), AUTOSAVE_DEBOUNCE_MS);
      }
    },
    [questions, session.id, showServerResult, storageKey],
  );

  const setAnswers = (next: Answers) => {
    answersRef.current = next;
    versionRef.current += 1;
    writeStored(storageKey, { answers: next, pending: true });
    setAnswersState(next);
  };
  // Always merges into the latest answers: a recording may finish uploading after the learner moved to another question.
  const updateAnswer = (questionId: string, value: DraftAnswer) => setAnswers({ ...answersRef.current, [questionId]: value });

  // debounced save after changes
  React.useEffect(() => {
    if (versionRef.current === savedVersionRef.current) return;
    const id = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [answers, save]);

  // periodic save, save when connectivity returns, and flush when the page is hidden or closed
  React.useEffect(() => {
    const interval = setInterval(() => void save(), AUTOSAVE_INTERVAL_MS);
    const flush = () => void save(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onOnline = () => void save();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", onOnline);
    };
  }, [save]);

  const doSubmit = React.useCallback(
    (auto = false, retry = 0) => {
      if (doneRef.current || submittingRef.current) return;
      submittingRef.current = true;
      setFinishing(true);
      submit.mutate(
        { attemptId: session.id, body: { answers: toPayload(questions, answersRef.current) } },
        {
          onSuccess: (result) => finish(result, auto),
          onSettled: () => {
            submittingRef.current = false;
          },
          onError: (error) => {
            if (isApiError(error) && (error.code === "ATTEMPT_ALREADY_SUBMITTED" || error.code === "ATTEMPT_EXPIRED")) {
              void showServerResult();
              return;
            }
            setFinishing(false);
            if (auto && isApiError(error) && (error.status === 0 || error.status >= 500) && retry < 12) {
              // the timer ran out while offline: keep trying, answers stay saved on this device
              setSaveState({ kind: "offline" });
              setTimeout(() => {
                if (mountedRef.current) doSubmitRef.current?.(true, retry + 1);
              }, SUBMIT_RETRY_MS);
            }
            toast.error(errorMessage(error));
          },
        },
      );
    },
    [errorMessage, finish, questions, session.id, showServerResult, submit],
  );

  React.useEffect(() => {
    saveRef.current = save;
    doSubmitRef.current = doSubmit;
  }, [save, doSubmit]);

  if (!q) return null;
  const setAnswer = (value: DraftAnswer) => updateAnswer(q.id, value);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
            <span>{t("answeredOf", { answered: answeredCount, total: questions.length })}</span>
            {saveState.kind !== "idle" && <span aria-hidden>·</span>}
            <SaveIndicator state={saveState} />
          </p>
        </div>
        {session.deadline && <Countdown deadline={session.deadline} offset={offset} onExpire={() => doSubmit(true)} />}
      </div>
      {session.deadline && (
        <p className="flex items-center gap-1.5 border-b px-4 py-1.5 text-xs text-muted-foreground sm:px-6">
          <CalendarClock className="size-3.5 shrink-0" />
          {timeLimitCapped
            ? t("deadlineCapped", { minutes: session.timeLimitMinutes ?? 0, time: fmt.date(session.deadline, "HH:mm") })
            : t("deadlineAt", { time: fmt.dateTime(session.deadline) })}
        </p>
      )}
      <Progress value={(answeredCount / Math.max(1, questions.length)) * 100} className="h-1 rounded-none" />

      <div className="grid gap-0 lg:grid-cols-[1fr_200px]">
        <div className="p-5 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("questionOf", { current: index + 1, total: questions.length })} · {tc("points", { count: q.points })}
            </p>
            <Button
              variant="ghost"
              size="xs"
              aria-pressed={!!flags[q.id]}
              onClick={() => setFlags({ ...flags, [q.id]: !flags[q.id] })}
              className={cn(flags[q.id] && "text-warning")}
            >
              <Flag className={cn(flags[q.id] && "fill-current")} /> {flags[q.id] ? t("flagged") : t("flag")}
            </Button>
          </div>
          <div className="mt-4 grid gap-5" key={q.id}>
            <div id={`q-${q.id}-prompt`}>
              <QuestionPrompt prompt={q.prompt} type={q.type} />
            </div>
            <QuestionMedia media={q.media} />
            <QuestionInput question={q} value={answers[q.id] ?? emptyAnswer} onChange={setAnswer} />
          </div>
          {uploads > 0 && (
            <p role="status" className="mt-4 text-xs text-muted-foreground">
              {te("uploadPending")}
            </p>
          )}
          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft /> {tc("back")}
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex(index + 1)}>
                {tc("next")} <ArrowRight />
              </Button>
            ) : (
              <Button variant="brand" onClick={() => setConfirmOpen(true)} loading={finishing} disabled={uploads > 0}>
                <Send /> {t("submitAnswers")}
              </Button>
            )}
          </div>
        </div>

        <aside className="border-t p-4 lg:border-t-0 lg:border-l" aria-label={t("navigator")}>
          <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("questions")}</p>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
            {questions.map((x, i) => {
              const done = isAnswered(x, answers[x.id]);
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={[t("questionLabel", { n: i + 1 }), done ? t("answered") : null, flags[x.id] ? t("flaggedLabel") : null].filter(Boolean).join(", ")}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded-md border text-xs font-medium tabular-nums transition-colors hover:border-foreground/30",
                    done && "border-transparent bg-primary text-primary-foreground",
                    i === index && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                  )}
                >
                  {i + 1}
                  {flags[x.id] && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-warning" />}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setConfirmOpen(true)} disabled={finishing || uploads > 0}>
            {t("finish")}
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={unanswered > 0 ? t("confirmUnanswered", { count: unanswered }) : t("confirmAll")}
        confirmLabel={t("submitNow")}
        loading={finishing}
        onConfirm={() => {
          setConfirmOpen(false);
          doSubmit(false);
        }}
      />
    </div>
  );
}
