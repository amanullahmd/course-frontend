import { Download, ExternalLink } from "lucide-react";
import type { MediaDto } from "@/lib/api/types";
import { downloadUrl } from "@/lib/api/media";
import { fileStyle, FileTypeIcon } from "@/components/course/file-type-icon";
import { Button } from "@/components/ui/button";
import { cn, fileExtension, formatBytes } from "@/lib/utils";

export const isPdf = (m: MediaDto) => m.contentType === "application/pdf" || fileExtension(m.fileName) === "pdf";
export const isText = (m: MediaDto) =>
  m.contentType.startsWith("text/") || ["txt", "md", "csv", "srt", "vtt"].includes(fileExtension(m.fileName));

export function FileCard({ media, className }: { media: MediaDto; className?: string }) {
  const style = fileStyle(media.fileName, media.contentType, media.kind);
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs", className)}>
      <FileTypeIcon name={media.fileName} contentType={media.contentType} kind={media.kind} className="size-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={media.fileName}>
          {media.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {style.label} · {formatBytes(media.sizeBytes)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon-sm" asChild>
          <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${media.fileName} in a new tab`}>
            <ExternalLink />
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={downloadUrl(media)} aria-label={`Download ${media.fileName}`}>
            <Download /> <span className="hidden sm:inline">Download</span>
          </a>
        </Button>
      </div>
    </div>
  );
}

export function AttachmentList({ attachments, title = "Files" }: { attachments: MediaDto[]; title?: string }) {
  if (attachments.length === 0) return null;
  return (
    <section aria-label={title} className="grid gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="font-normal">({attachments.length})</span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((a) => (
          <FileCard key={a.id} media={a} />
        ))}
      </div>
    </section>
  );
}
