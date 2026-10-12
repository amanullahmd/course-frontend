"use client";

import * as React from "react";
import { AlertTriangle, Mic, MicOff, RotateCcw, Square, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MediaDto } from "@/lib/api/types";
import { mediaApi } from "@/lib/api/media";
import { formatClock, pickRecorderMime, recordingFile } from "@/lib/exercises";
import { uploadTracker } from "@/lib/upload-tracker";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/learn/audio-player";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Phase = "idle" | "requesting" | "recording" | "uploading";
type Problem = "denied" | "noMic" | "busy" | "failed" | "insecure" | "uploadFailed" | null;

interface AudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function canRecord(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

/**
 * Records an answer in the browser (MediaRecorder), uploads it as the learner's own media file and hands the result
 * to {@code onChange}. Covers permission prompt, level meter, countdown, replay, re-recording, upload progress and
 * clear states for a blocked microphone, no microphone and browsers without recording support (file upload instead).
 */
export function AudioRecorder({
  maxSeconds,
  media,
  onChange,
  disabled = false,
}: {
  maxSeconds: number;
  media: MediaDto | null;
  onChange: (media: MediaDto | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("exercises.recorder");
  // null while rendering on the server / hydrating, then whether this browser can record
  const supported = React.useSyncExternalStore(
    () => () => {},
    canRecord,
    () => null,
  );
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [problem, setProblem] = React.useState<Problem>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [retryFile, setRetryFile] = React.useState<File | null>(null);
  const meterRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const cleanupRef = React.useRef<() => void>(() => {});
  const mediaRef = React.useRef(media);
  const onChangeRef = React.useRef(onChange);
  const discardRef = React.useRef(false);
  React.useEffect(() => {
    mediaRef.current = media;
    onChangeRef.current = onChange;
  });

  const releaseAudio = React.useCallback(() => {
    cleanupRef.current();
    cleanupRef.current = () => {};
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (meterRef.current) meterRef.current.style.transform = "scaleX(0)";
  }, []);

  // leaving the question while recording discards the unfinished recording
  React.useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      releaseAudio();
    },
    [releaseAudio],
  );

  const upload = React.useCallback(async (file: File) => {
    setPhase("uploading");
    setProblem(null);
    setProgress(0);
    setRetryFile(null);
    uploadTracker.begin();
    try {
      const uploaded = await mediaApi.upload(file, { onProgress: setProgress });
      const previous = mediaRef.current;
      onChangeRef.current(uploaded);
      // the replaced recording is not needed any more (best effort, it only frees quota)
      if (previous && previous.id !== uploaded.id) void mediaApi.remove(previous.id).catch(() => {});
      setPhase("idle");
    } catch {
      setRetryFile(file);
      setProblem("uploadFailed");
      setPhase("idle");
    } finally {
      uploadTracker.end();
    }
  }, []);

  const stop = React.useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = async () => {
    setProblem(null);
    setRetryFile(null);
    if (!window.isSecureContext) {
      setProblem("insecure");
      return;
    }
    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setProblem(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "noMic"
            : name === "NotReadableError" || name === "AbortError"
              ? "busy"
              : "failed",
      );
      setPhase("idle");
      return;
    }
    streamRef.current = stream;
    let rec: MediaRecorder;
    const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      releaseAudio();
      setProblem("failed");
      setPhase("idle");
      return;
    }
    const chunks: Blob[] = [];
    discardRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onerror = () => {
      releaseAudio();
      setProblem("failed");
      setPhase("idle");
    };
    rec.onstop = () => {
      releaseAudio();
      if (discardRef.current || chunks.length === 0) {
        setPhase("idle");
        return;
      }
      const recorded = recordingFile(rec.mimeType || mime || "audio/webm");
      void upload(new File(chunks, recorded.name, { type: recorded.type }));
    };

    // level meter (decorative) and countdown
    try {
      const Ctx = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let raf = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / data.length) * 3.5);
          if (meterRef.current) meterRef.current.style.transform = `scaleX(${level.toFixed(3)})`;
          raf = requestAnimationFrame(tick);
        };
        tick();
        cleanupRef.current = () => {
          cancelAnimationFrame(raf);
          void ctx.close().catch(() => {});
        };
      }
    } catch {
      /* the meter is optional */
    }
    const startedAt = performance.now();
    setElapsed(0);
    const timer = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stop();
    }, 200);
    const previousCleanup = cleanupRef.current;
    cleanupRef.current = () => {
      window.clearInterval(timer);
      previousCleanup();
    };
    recorderRef.current = rec;
    rec.start(500);
    setPhase("recording");
  };

  const remove = () => {
    const previous = media;
    onChange(null);
    if (previous) void mediaApi.remove(previous.id).catch(() => {});
  };

  const busy = phase === "requesting" || phase === "uploading";
  const remaining = Math.max(0, maxSeconds - elapsed);
  const problemText = problem ? t(problem) : null;

  if (supported === null) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted/40" aria-hidden />;
  }

  return (
    <section aria-label={t("title")} className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="size-4 text-brand-strong" /> {t("title")}
        </h4>
        <span className="text-xs text-muted-foreground tabular-nums">{t("maxLength", { time: formatClock(maxSeconds) })}</span>
      </div>

      {phase === "recording" && (
        <div className="grid gap-3" role="group" aria-label={t("recording")}>
          <div className="flex items-center gap-3">
            <span className="relative flex size-3 shrink-0" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-destructive" />
            </span>
            <span className="text-sm font-medium">{t("recording")}</span>
            <span className="ml-auto font-mono text-lg font-semibold tabular-nums" aria-live="off">
              {formatClock(elapsed)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("level")}>
            <div ref={meterRef} className="h-full origin-left rounded-full bg-success transition-transform duration-75" style={{ transform: "scaleX(0)" }} />
          </div>
          <Progress value={(elapsed / maxSeconds) * 100} className="h-1" aria-label={t("left", { time: formatClock(remaining) })} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">{t("left", { time: formatClock(remaining) })}</p>
            <Button type="button" variant="destructive" onClick={stop}>
              <Square className="fill-current" /> {t("stop")}
            </Button>
          </div>
        </div>
      )}

      {phase === "requesting" && <p className="text-sm text-muted-foreground">{t("requesting")}</p>}

      {phase === "uploading" && (
        <div className="grid gap-2" role="status">
          <p className="text-sm">{t("uploading", { percent: progress })}</p>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {phase === "idle" && media && (
        <div className="grid gap-3">
          <AudioPlayer src={media.url} title={t("replay")} compact />
          <p className="text-xs text-success">{t("saved")}</p>
        </div>
      )}

      {problemText && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft/60 px-3 py-2 text-sm text-destructive">
          {problem === "denied" || problem === "noMic" ? <MicOff className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <span>{problemText}</span>
        </p>
      )}

      {supported === false && !problemText && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft/60 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{t("unsupported")}</span>
        </p>
      )}

      {phase !== "recording" && (
        <div className="flex flex-wrap items-center gap-2">
          {supported && (
            <Button type="button" variant={media ? "outline" : "brand"} onClick={() => void start()} disabled={disabled || busy}>
              {media ? <RotateCcw /> : <Mic />} {media ? t("again") : t("start")}
            </Button>
          )}
          {retryFile && (
            <Button type="button" variant="brand" onClick={() => void upload(retryFile)} disabled={busy}>
              <Upload /> {t("retryUpload")}
            </Button>
          )}
          {media && phase === "idle" && (
            <Button type="button" variant="ghost" onClick={remove} disabled={disabled}>
              <Trash2 /> {t("remove")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-muted-foreground", supported ? "ml-auto" : "")}
            onClick={() => fileRef.current?.click()}
            disabled={disabled || busy}
          >
            <Upload /> {t("uploadInstead")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg"
            className="sr-only"
            tabIndex={-1}
            aria-label={t("uploadInstead")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {phase !== "recording" && !media && <p className="text-xs text-muted-foreground">{t("uploadHint")}</p>}
    </section>
  );
}
