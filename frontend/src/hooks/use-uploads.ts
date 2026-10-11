"use client";

import * as React from "react";
import { mediaApi } from "@/lib/api/media";
import type { MediaDto } from "@/lib/api/types";

export interface UploadEntry {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: unknown;
  media?: MediaDto;
}

let counter = 0;
const nextId = () => `upload-${Date.now().toString(36)}-${(counter += 1)}`;

/** Queue of concurrent media uploads with per-file progress, cancel and retry. */
export function useUploads(options: { onUploaded?: (media: MediaDto, file: File) => void } = {}) {
  const [uploads, setUploads] = React.useState<UploadEntry[]>([]);
  const controllers = React.useRef(new Map<string, AbortController>());
  const onUploadedRef = React.useRef(options.onUploaded);

  React.useEffect(() => {
    onUploadedRef.current = options.onUploaded;
  });

  React.useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const patch = React.useCallback((id: string, update: Partial<UploadEntry>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...update } : u)));
  }, []);

  const start = React.useCallback(
    (file: File, existingId?: string) => {
      const id = existingId ?? nextId();
      const controller = new AbortController();
      controllers.current.set(id, controller);
      setUploads((list) =>
        existingId
          ? list.map((u) => (u.id === id ? { ...u, status: "uploading", progress: 0, error: undefined } : u))
          : [...list, { id, file, progress: 0, status: "uploading" }],
      );
      mediaApi
        .upload(file, { signal: controller.signal, onProgress: (progress) => patch(id, { progress }) })
        .then((media) => {
          patch(id, { status: "done", progress: 100, media });
          onUploadedRef.current?.(media, file);
          window.setTimeout(() => setUploads((list) => list.filter((u) => u.id !== id)), 2500);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            setUploads((list) => list.filter((u) => u.id !== id));
            return;
          }
          patch(id, { status: "error", error });
        })
        .finally(() => controllers.current.delete(id));
    },
    [patch],
  );

  const upload = React.useCallback((files: File[]) => files.forEach((f) => start(f)), [start]);
  const cancel = React.useCallback((id: string) => controllers.current.get(id)?.abort(), []);
  const dismiss = React.useCallback((id: string) => setUploads((list) => list.filter((u) => u.id !== id)), []);
  const retry = React.useCallback(
    (id: string) => {
      const entry = uploads.find((u) => u.id === id);
      if (entry) start(entry.file, id);
    },
    [uploads, start],
  );

  return {
    uploads,
    upload,
    cancel,
    retry,
    dismiss,
    isUploading: uploads.some((u) => u.status === "uploading"),
  };
}
