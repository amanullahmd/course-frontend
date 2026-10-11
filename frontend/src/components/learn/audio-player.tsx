"use client";

import * as React from "react";
import { Download, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Listening-practice audio player with speed control and 5s skips. */
export function AudioPlayer({
  src,
  title,
  downloadHref,
  compact = false,
  className,
}: {
  src: string;
  title?: string;
  downloadHref?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("audio");
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState<number>(1);
  const [muted, setMuted] = React.useState(false);
  const [error, setError] = React.useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setError(true));
    else el.pause();
  };
  const skip = (delta: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  };
  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  };
  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div
      className={cn("rounded-xl border bg-card shadow-xs", compact ? "p-3" : "p-4 sm:p-5", className)}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          toggle();
        } else if (e.key === "ArrowLeft") skip(-5);
        else if (e.key === "ArrowRight") skip(5);
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = speed;
        }}
        onError={() => setError(true)}
      />
      {title && !compact && <p className="mb-3 truncate text-sm font-medium">{title}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={error}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          aria-label={playing ? t("pause") : t("play")}
        >
          {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          {title && compact && <p className="mb-1 truncate text-xs font-medium">{title}</p>}
          <div className="relative flex h-5 items-center">
            <div className="absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrent(t);
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              className="relative h-5 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow"
              aria-label={t("seek")}
              aria-valuetext={t("of", { current: fmt(current), total: fmt(duration) })}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => skip(-5)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("back5")}>
            <RotateCcw className="size-3.5" /> 5s
          </button>
          <button type="button" onClick={() => skip(5)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("forward5")}>
            5s <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMuted((m) => !m);
              if (audioRef.current) audioRef.current.muted = !muted;
            }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={muted ? t("unmute") : t("mute")}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t("speed")}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={speed === s}
              onClick={() => changeSpeed(s)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground tabular-nums transition-colors hover:bg-accent hover:text-foreground",
                speed === s && "bg-brand-soft text-brand-strong hover:bg-brand-soft",
              )}
            >
              {s}×
            </button>
          ))}
          {downloadHref && (
            <a href={downloadHref} className="ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={t("download")}>
              <Download className="size-3.5" />
            </a>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{t("error")}</p>}
    </div>
  );
}
