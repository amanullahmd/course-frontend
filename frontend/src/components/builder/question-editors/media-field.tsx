"use client";

import * as React from "react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { MediaDto } from "@/lib/api/types";
import { mediaApi } from "@/lib/api/media";
import { useErrorMessage } from "@/hooks/use-error-message";
import { AudioPlayer } from "@/components/learn/audio-player";
import { Button } from "@/components/ui/button";

/** Upload slot for a question's audio or image. */
export function MediaField({
  media,
  onChange,
  audioOnly = false,
  invalid = false,
}: {
  media: MediaDto | null | undefined;
  onChange: (m: MediaDto | null) => void;
  audioOnly?: boolean;
  invalid?: boolean;
}) {
  const t = useTranslations("question");
  const errorMessage = useErrorMessage();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const upload = async (file: File) => {
    setProgress(0);
    try {
      const m = await mediaApi.upload(file, { onProgress: setProgress });
      onChange(m);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="grid gap-2">
      {media ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-2">
          <div className="min-w-0 flex-1">
            {media.kind === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed media URL
              <img src={media.url} alt="" className="max-h-40 rounded-md border object-contain" />
            ) : media.kind === "AUDIO" ? (
              <AudioPlayer src={media.url} title={media.fileName} compact />
            ) : (
              <p className="truncate text-sm">{media.fileName}</p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(null)} aria-label={t("removeMedia")}>
            <X />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={invalid ? "w-fit border-destructive/50" : "w-fit"}
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
        >
          {progress !== null ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          {progress !== null ? t("uploading", { percent: progress }) : t("addMedia")}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={audioOnly ? "audio/*" : "audio/*,image/*"}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("addMedia")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
