"use client";

import * as React from "react";
import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FlashcardArticle, MediaDto } from "@/lib/api/types";
import { ARTICLE_META } from "@/lib/flashcards";
import { cn } from "@/lib/utils";
import { ArticleBadge } from "./article-badge";

export interface CardContent {
  front: string;
  back: string;
  article: FlashcardArticle | null;
  plural: string | null;
  example: string | null;
  audio: MediaDto | null;
  image: MediaDto | null;
}

/** Plays a card's audio; a new play stops the previous one. */
export function useCardAudio() {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const stop = React.useCallback(() => {
    ref.current?.pause();
    ref.current = null;
  }, []);
  const play = React.useCallback(
    (url: string) => {
      stop();
      const audio = new Audio(url);
      ref.current = audio;
      void audio.play().catch(() => {
        /* autoplay blocked or the file is unavailable: the button stays usable */
      });
    },
    [stop],
  );
  React.useEffect(() => stop, [stop]);
  return { play, stop };
}

export function AudioButton({ audio, onPlay, className }: { audio: MediaDto; onPlay: (url: string) => void; className?: string }) {
  const t = useTranslations("flashcards");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPlay(audio.url);
      }}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      aria-label={t("playAudio")}
    >
      <Volume2 className="size-4" aria-hidden />
    </button>
  );
}

/** Front of a card: the word (without article), an optional picture and the audio button. */
export function CardFront({ card, onPlay, large = false }: { card: CardContent; onPlay: (url: string) => void; large?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center sm:p-8">
      {card.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image.url} alt="" className={cn("rounded-lg object-contain", large ? "max-h-44" : "max-h-28")} />
      )}
      <p className={cn("font-semibold tracking-tight text-balance break-words hyphens-auto", large ? "text-3xl sm:text-4xl" : "text-xl")} lang="de">
        {card.front}
      </p>
      {card.audio && <AudioButton audio={card.audio} onPlay={onPlay} />}
    </div>
  );
}

/** Back of a card: article (coloured and spelled out), word, translation, plural and example. */
export function CardBack({ card, onPlay, large = false }: { card: CardContent; onPlay: (url: string) => void; large?: boolean }) {
  const t = useTranslations("flashcards");
  const accent = card.article ? ARTICLE_META[card.article] : null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center sm:p-8">
      <p className={cn("flex flex-wrap items-center justify-center gap-2 font-semibold tracking-tight break-words", large ? "text-2xl sm:text-3xl" : "text-lg")} lang="de">
        {card.article && <ArticleBadge article={card.article} className={large ? "text-lg" : "text-sm"} />}
        <span>{card.front}</span>
        {card.audio && <AudioButton audio={card.audio} onPlay={onPlay} className="size-8" />}
      </p>
      <p className={cn("text-balance break-words", large ? "text-xl sm:text-2xl" : "text-base")}>{card.back}</p>
      {(card.plural || card.example) && (
        <dl className="mt-1 grid gap-1.5 text-sm text-muted-foreground">
          {card.plural && (
            <div>
              <dt className="inline text-xs tracking-wide uppercase">{t("plural")}: </dt>
              <dd className="inline font-medium text-foreground" lang="de">
                {card.plural}
              </dd>
            </div>
          )}
          {card.example && (
            <div>
              <dd className="italic" lang="de">
                „{card.example}“
              </dd>
            </div>
          )}
        </dl>
      )}
      {accent && <span className="sr-only">{t("articleIs", { article: card.article ?? "" })}</span>}
    </div>
  );
}
