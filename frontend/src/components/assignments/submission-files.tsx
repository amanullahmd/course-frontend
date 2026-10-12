"use client";

import { Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SubmissionFileDto } from "@/lib/api/types";
import { downloadUrl } from "@/lib/api/media";
import { formatBytes } from "@/lib/utils";
import { FileTypeIcon } from "@/components/course/file-type-icon";
import { Button } from "@/components/ui/button";

/**
 * Files of a submission: icon, name, size, download and "open" (inline) links. Images and audio are previewed inline.
 */
export function SubmissionFiles({ files, label }: { files: SubmissionFileDto[]; label?: string }) {
  const t = useTranslations("assignments");
  if (files.length === 0) return null;
  return (
    <ul className="grid gap-2" aria-label={label ?? t("files")}>
      {files.map(({ media }) => (
        <li key={media.id} className="rounded-lg border bg-card p-2.5">
          <div className="flex items-center gap-3">
            <FileTypeIcon name={media.fileName} contentType={media.contentType} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={media.fileName}>
                {media.fileName}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatBytes(media.sizeBytes)}</p>
            </div>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={t("openFile", { name: media.fileName })}>
                <ExternalLink />
              </a>
            </Button>
            <Button variant="outline" size="icon-sm" asChild>
              <a href={downloadUrl(media)} download={media.fileName} aria-label={t("downloadFile", { name: media.fileName })}>
                <Download />
              </a>
            </Button>
          </div>
          {media.kind === "IMAGE" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.fileName} className="mt-2.5 max-h-64 w-auto max-w-full rounded-md border object-contain" />
          )}
          {media.kind === "AUDIO" && <audio controls preload="none" src={media.url} className="mt-2.5 w-full" aria-label={media.fileName} />}
        </li>
      ))}
    </ul>
  );
}
