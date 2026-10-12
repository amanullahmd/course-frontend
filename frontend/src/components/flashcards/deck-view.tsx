"use client";

import * as React from "react";
import Link from "next/link";
import { Layers, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LearnItemDto, LearnerCardDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useLearnerDeck } from "@/hooks/queries/practice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleBadge } from "./article-badge";
import { AudioButton, useCardAudio } from "./card-faces";

function MiniCard({ card, onPlay }: { card: LearnerCardDto; onPlay: (url: string) => void }) {
  const t = useTranslations("flashcards");
  const [open, setOpen] = React.useState(false);
  return (
    <li>
      <div
        className={cn(
          "flex h-full flex-col rounded-xl border bg-card p-3.5 shadow-xs transition-colors",
          open && "border-brand/40 bg-brand-soft/30",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5 break-words">
              {open && card.article && <ArticleBadge article={card.article} className="text-xs" />}
              <span className="font-medium" lang="de">
                {card.front}
              </span>
            </span>
            <span className={cn("mt-0.5 block text-sm break-words", open ? "text-foreground" : "text-transparent select-none")} aria-hidden={!open}>
              {card.back}
            </span>
            {!open && <span className="sr-only">{t("tapToReveal")}</span>}
          </span>
          {!open && <span className="shrink-0 text-[11px] text-muted-foreground">{t("tapToReveal")}</span>}
        </button>
        {open && (card.plural || card.example) && (
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {card.plural && (
              <p>
                {t("plural")}: <span className="font-medium text-foreground" lang="de">{card.plural}</span>
              </p>
            )}
            {card.example && <p className="italic" lang="de">„{card.example}“</p>}
          </div>
        )}
        {card.audio && (
          <div className="mt-2">
            <AudioButton audio={card.audio} onPlay={onPlay} className="size-8" />
          </div>
        )}
      </div>
    </li>
  );
}

/** Learner view of a FLASHCARDS item: counters, "Start review" and a browsable list of the cards. */
export function FlashcardDeckView({ item }: { item: LearnItemDto }) {
  const t = useTranslations("flashcards");
  const deck = useLearnerDeck(item.id);
  const { play } = useCardAudio();

  if (deck.isPending) return <Skeleton className="h-48 rounded-xl" />;
  if (deck.isError) return <ErrorState error={deck.error} onRetry={() => deck.refetch()} />;
  const { cards, dueCount, newCount } = deck.data;
  if (cards.length === 0) {
    return <EmptyState icon={Layers} title={t("emptyDeckTitle")} description={t("emptyDeckText")} compact />;
  }
  return (
    <section aria-labelledby="deck-heading" className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="deck-heading" className="font-semibold">
            {t("deckTitle", { count: cards.length })}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={dueCount > 0 ? "brand" : "secondary"}>{t("dueCount", { count: dueCount })}</Badge>
            <Badge variant={newCount > 0 ? "info" : "secondary"}>{t("newCount", { count: newCount })}</Badge>
          </p>
        </div>
        <Button asChild>
          <Link href={`/learn/${item.courseId}/review`}>
            <Play /> {t("startReview")}
          </Link>
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("cardList")}>
        {cards.map((c) => (
          <MiniCard key={c.id} card={c} onPlay={play} />
        ))}
      </ul>
    </section>
  );
}
