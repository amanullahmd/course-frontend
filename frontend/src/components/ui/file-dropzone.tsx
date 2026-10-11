"use client";

import * as React from "react";
import { CircleCheck, CloudUpload, RotateCw, TriangleAlert, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { UploadEntry } from "@/hooks/use-uploads";
import { Progress } from "./progress";
import { FileTypeIcon } from "@/components/course/file-type-icon";
import { useTranslations } from "next-intl";

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  title?: string;
  hint?: string;
  compact?: boolean;
  className?: string;
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  title: titleProp,
  hint: hintProp,
  compact = false,
  className,
}: FileDropzoneProps) {
  const t = useTranslations("ui");
  const title = titleProp ?? t("dropTitle");
  const hint = hintProp ?? t("dropHint");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);

  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={title}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (disabled) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 text-center transition-all outline-none hover:border-foreground/25 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-4 py-5" : "px-6 py-10",
        dragging && "scale-[1.01] border-brand bg-brand-soft/50",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-xl border bg-card text-muted-foreground shadow-xs transition-colors group-hover:text-foreground",
          compact ? "size-9" : "size-11",
          dragging && "border-brand text-brand-strong",
        )}
      >
        <CloudUpload className={compact ? "size-4" : "size-5"} />
      </span>
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">{dragging ? t("dropRelease") : title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function UploadProgressList({
  uploads,
  onCancel,
  onRetry,
  onDismiss,
}: {
  uploads: UploadEntry[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const t = useTranslations("ui");
  const tc = useTranslations("common");
  if (uploads.length === 0) return null;
  return (
    <ul className="grid gap-2" aria-label={t("uploads")}>
      {uploads.map((u) => (
        <li key={u.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5 pr-3 animate-slide-up">
          <FileTypeIcon name={u.file.name} contentType={u.file.type} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{u.file.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {u.status === "uploading" ? `${u.progress}%` : formatBytes(u.file.size)}
              </span>
            </div>
            {u.status === "uploading" && <Progress value={u.progress} className="mt-1.5 h-1.5" />}
            {u.status === "error" && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                <TriangleAlert className="size-3" /> {u.error}
              </p>
            )}
            {u.status === "done" && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                <CircleCheck className="size-3" /> {t("uploaded")}
              </p>
            )}
          </div>
          {u.status === "uploading" && onCancel && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              onClick={() => onCancel(u.id)}
              aria-label={t("cancelUpload", { name: u.file.name })}
            >
              <X className="size-4" />
            </button>
          )}
          {u.status === "error" && onRetry && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              onClick={() => onRetry(u.id)}
              aria-label={t("retryUpload", { name: u.file.name })}
            >
              <RotateCw className="size-4" />
            </button>
          )}
          {u.status !== "uploading" && onDismiss && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              onClick={() => onDismiss(u.id)}
              aria-label={tc("dismiss")}
            >
              <X className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
