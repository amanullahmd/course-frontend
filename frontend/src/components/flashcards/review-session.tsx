"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Layers, RotateCw, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { ReviewCardDto } from "@/lib/api/types";
import {
  GRADES,
  GRADE_KEYS,
  accuracyPercent,
  answerCard,
  isFinished,
  progressPercent,
  startQueue,
  type Grade,
  type ReviewQueue,
} from "@/lib/flashcards";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useHotkey } from "@/hooks/use-hotkey";
import { usePersistentState } from "@/hooks/use-local-storage";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useGradeCard, useReviewSession } from "@/hooks/queries/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CardBack, CardFront, useCardAudio } from "./card-faces";

const GRADE_STYLE: Record<Grade, string> = {
  AGAIN: "border-destructive/40 text-destructive hover:bg-destructive-soft",
  HARD: "border-warning/50 text-warning hover:bg-warning-soft",
  GOOD: "border-info/40 text-info hover:bg-info-soft",
  EASY: "border-success/40 text-success hover:bg-success-soft",
};

/** The flip card. 3D flip normally, a plain swap (no animation) when the user prefers reduced motion. */
function FlipCard({
  card,
  flipped,
  onFlip,
  onPlay,
}: {
  card: ReviewCardDto;
  flipped: boolean;
  onFlip: () => void;
  onPlay: (url: string) => void;
}) {
  const t = useTranslations("flashcards");
  const reduced = usePrefersReducedMotion();
  const shell =
    "rounded-2xl border bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] [&_*]:select-none";
  if (reduced) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => !flipped && onFlip()}
        aria-label={flipped ? t("cardBack") : t("showAnswer")}
        className={cn(shell, "min-h-72 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-80", flipped && "cursor-default")}
        data-flipped={flipped}
      >
        {flipped ? <CardBack card={card} onPlay={onPlay} large /> : <CardFront card={card} onPlay={onPlay} large />}
      </div>
    );
  }
  return (
    <div className="[perspective:1400px]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !flipped && onFlip()}
        aria-label={flipped ? t("cardBack") : t("showAnswer")}
        data-flipped={flipped}
        className={cn(
          "relative grid min-h-72 cursor-pointer outline-none [transform-style:preserve-3d] focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring sm:min-h-80",
          "transition-transform duration-500 ease-out",
          flipped && "cursor-default [transform:rotateY(180deg)]",
        )}
      >
        <div className={cn(shell, "col-start-1 row-start-1 [backface-visibility:hidden]")} aria-hidden={flipped} inert={flipped}>
          <CardFront card={card} onPlay={onPlay} large />
        </div>
        <div
          className={cn(shell, "col-start-1 row-start-1 [backface-visibility:hidden] [transform:rotateY(180deg)]")}
          aria-hidden={!flipped}
          inert={!flipped}
        >
          <CardBack card={card} onPlay={onPlay} large />
        </div>
      </div>
    </div>
  );
}

function Player({ courseId, cards, onMore }: { courseId: string; cards: ReviewCardDto[]; onMore: () => void }) {
  const t = useTranslations("flashcards");
  const errorMessage = useErrorMessage();
  const grade = useGradeCard();
  const { play, stop } = useCardAudio();
  const [state, setState] = React.useState<ReviewQueue<ReviewCardDto>>(() => startQueue(cards));
  const [flipped, setFlipped] = React.useState(false);
  const [autoplay, setAutoplay] = usePersistentState("sw.review.autoplay", false);
  const current = state.queue[0];

  // auto-play the audio of the next front side
  React.useEffect(() => {
    if (autoplay && current?.audio) play(current.audio.url);
    return stop;
  }, [autoplay, current?.id, current?.audio, play, stop]);

  const onGrade = React.useCallback(
    (g: Grade) => {
      if (!current || !flipped) return;
      grade.mutate(
        { cardId: current.id, grade: g },
        { onError: (err) => toast.error(errorMessage(err)) },
      );
      setState((s) => answerCard(s, g));
      setFlipped(false);
    },
    [current, flipped, grade, errorMessage],
  );

  const flip = React.useCallback(() => {
    if (current && !flipped) setFlipped(true);
  }, [current, flipped]);

  useHotkey(" ", (e) => {
    e.preventDefault();
    flip();
  }, { enabled: !!current && !flipped });
  useHotkey("enter", (e) => {
    e.preventDefault();
    flip();
  }, { enabled: !!current && !flipped });
  const gradeKeysOn = !!current && flipped;
  useHotkey("1", () => onGrade(GRADE_KEYS["1"]), { enabled: gradeKeysOn });
  useHotkey("2", () => onGrade(GRADE_KEYS["2"]), { enabled: gradeKeysOn });
  useHotkey("3", () => onGrade(GRADE_KEYS["3"]), { enabled: gradeKeysOn });
  useHotkey("4", () => onGrade(GRADE_KEYS["4"]), { enabled: gradeKeysOn });
  useHotkey("a", () => current?.audio && play(current.audio.url), { enabled: !!current?.audio });

  if (isFinished(state)) {
    const accuracy = accuracyPercent(state);
    return (
      <div className="mx-auto grid w-full max-w-xl gap-6 text-center">
        <div className="grid justify-items-center gap-3 rounded-2xl border bg-card p-8 shadow-sm">
          <span className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
            <Sparkles className="size-7" aria-hidden />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">{t("doneTitle")}</h2>
          <p className="text-muted-foreground">{t("doneText", { count: state.total })}</p>
          {accuracy !== null && (
            <p className="text-sm">
              {t("accuracy")}: <span className="font-semibold tabular-nums">{accuracy}%</span>
            </p>
          )}
          <dl className="mt-2 grid w-full grid-cols-4 gap-2 text-center">
            {GRADES.map((g) => (
              <div key={g} className="rounded-lg border bg-muted/40 px-1 py-2">
                <dt className="text-[11px] text-muted-foreground">{t(`grade.${g}`)}</dt>
                <dd className="text-lg font-semibold tabular-nums">{state.counts[g]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onMore}>
            <RotateCw /> {t("reviewMore")}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/learn/${courseId}`}>{t("backToCourse")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Layers className="size-4" aria-hidden />
            <span className="max-w-[10rem] truncate sm:max-w-xs">{current.deckTitle}</span>
            <Badge variant={current.newCard ? "info" : "brand"}>{current.newCard ? t("new") : t("due")}</Badge>
          </span>
          <span className="shrink-0 font-medium whitespace-nowrap tabular-nums" aria-live="polite">
            {t("progress", { done: state.done, total: state.total })}
          </span>
        </div>
        <Progress value={progressPercent(state)} aria-label={t("progressLabel")} />
      </div>

      <FlipCard card={current} flipped={flipped} onFlip={flip} onPlay={play} />

      <div className="min-h-24">
        {flipped ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t("howWell")}>
            {GRADES.map((g, i) => (
              <Button
                key={g}
                variant="outline"
                size="lg"
                className={cn("h-auto flex-col gap-1 py-3", GRADE_STYLE[g])}
                onClick={() => onGrade(g)}
              >
                <span className="font-semibold">{t(`grade.${g}`)}</span>
                <Kbd className="hidden sm:inline-flex">{i + 1}</Kbd>
              </Button>
            ))}
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={flip}>
            <Check /> {t("showAnswer")}
            <Kbd className="ml-1 hidden border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80 sm:inline-flex">
              {t("space")}
            </Kbd>
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <Label className="flex cursor-pointer items-center gap-2 font-normal">
          <Switch checked={autoplay} onCheckedChange={setAutoplay} aria-label={t("autoplay")} />
          <Volume2 className="size-3.5" aria-hidden /> {t("autoplay")}
        </Label>
        <span className="hidden sm:inline">{t("keyHint")}</span>
      </div>
    </div>
  );
}

export function ReviewSession() {
  const { courseId } = useParams<{ courseId: string }>();
  const t = useTranslations("flashcards");
  const [round, setRound] = React.useState(0);
  const session = useReviewSession(courseId);
  const { refetch } = session;

  const more = React.useCallback(() => {
    void refetch().then(() => setRound((r) => r + 1));
  }, [refetch]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/learn/${courseId}`}>
            <ArrowLeft /> {t("backToCourse")}
          </Link>
        </Button>
        <h1 className="sr-only text-lg font-semibold tracking-tight sm:not-sr-only sm:text-xl">{t("reviewTitle")}</h1>
        <span className="w-24" aria-hidden />
      </div>
      {session.isPending ? (
        <div className="mx-auto grid max-w-2xl gap-5">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : session.isError ? (
        <ErrorState error={session.error} onRetry={() => session.refetch()} />
      ) : session.data.cards.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={
            <Button asChild>
              <Link href={`/learn/${courseId}`}>{t("backToCourse")}</Link>
            </Button>
          }
        />
      ) : (
        <Player key={`${round}-${session.dataUpdatedAt}`} courseId={courseId} cards={session.data.cards} onMore={more} />
      )}
    </div>
  );
}
