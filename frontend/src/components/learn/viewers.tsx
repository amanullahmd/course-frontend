"use client";

import * as React from "react";
import { ExternalLink, Globe } from "lucide-react";
import type { LearnItemDto, MediaDto } from "@/lib/api/types";
import { downloadUrl } from "@/lib/api/media";
import { getEmbedInfo } from "@/lib/embed";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioPlayer } from "./audio-player";
import { FileCard, isPdf, isText } from "./attachments";
import { ImageGallery } from "./image-gallery";

export function EmbedFrame({ url, title, className }: { url: string; title: string; className?: string }) {
  const info = getEmbedInfo(url);
  if (!info) return null;
  if (!info.embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md", className)}
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
          <Globe className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium group-hover:underline">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{url}</span>
        </span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
      </a>
    );
  }
  const isVideo = info.provider === "youtube" || info.provider === "vimeo";
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-black shadow-sm", isVideo ? "aspect-video" : "h-[70vh]", className)}>
      <iframe
        src={info.embedUrl}
        title={title}
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}

function VideoViewer({ item, videos }: { item: LearnItemDto; videos: MediaDto[] }) {
  return (
    <div className="grid gap-4">
      {item.externalUrl && <EmbedFrame url={item.externalUrl} title={item.title} />}
      {videos.map((v) => (
        <figure key={v.id} className="overflow-hidden rounded-xl border bg-black shadow-sm">
          <video controls preload="metadata" src={v.url} className="aspect-video w-full" playsInline>
            <track kind="captions" />
            Your browser does not support embedded video. <a href={downloadUrl(v)}>Download the video</a>.
          </video>
          {videos.length > 1 && <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">{v.fileName}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

function PdfFrame({ media }: { media: MediaDto }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-muted shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <p className="truncate text-sm font-medium">{media.fileName}</p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="xs" asChild>
            <a href={media.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Open
            </a>
          </Button>
          <Button variant="outline" size="xs" asChild>
            <a href={downloadUrl(media)}>Download</a>
          </Button>
        </div>
      </div>
      <iframe src={media.url} title={media.fileName} className="h-[75vh] w-full bg-white" />
    </div>
  );
}

function DocumentViewer({ docs }: { docs: MediaDto[] }) {
  const inline = docs.filter((d) => isPdf(d) || isText(d));
  const others = docs.filter((d) => !isPdf(d) && !isText(d));
  return (
    <div className="grid gap-4">
      {inline.length === 1 && <PdfFrame media={inline[0]} />}
      {inline.length > 1 && (
        <Tabs defaultValue={inline[0].id}>
          <TabsList className="max-w-full">
            {inline.map((d) => (
              <TabsTrigger key={d.id} value={d.id} className="max-w-48">
                <span className="truncate">{d.fileName}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {inline.map((d) => (
            <TabsContent key={d.id} value={d.id} className="mt-3">
              <PdfFrame media={d} />
            </TabsContent>
          ))}
        </Tabs>
      )}
      {others.length > 0 && (
        <div className="grid gap-2">
          {others.map((d) => (
            <FileCard key={d.id} media={d} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Primary viewer for an item, chosen by its type. Returns the attachments it already displayed. */
export function ItemViewer({ item }: { item: LearnItemDto }): React.ReactElement | null {
  const by = (kind: MediaDto["kind"]) => item.attachments.filter((a) => a.kind === kind);
  switch (item.type) {
    case "VIDEO": {
      const videos = by("VIDEO");
      if (!item.externalUrl && videos.length === 0) return null;
      return <VideoViewer item={item} videos={videos} />;
    }
    case "AUDIO": {
      const audios = by("AUDIO");
      if (audios.length === 0) return null;
      return (
        <div className="grid gap-3">
          {audios.map((a) => (
            <AudioPlayer key={a.id} src={a.url} title={a.fileName} downloadHref={downloadUrl(a)} />
          ))}
        </div>
      );
    }
    case "IMAGE":
      return <ImageGallery images={by("IMAGE")} />;
    case "DOCUMENT": {
      const docs = item.attachments.filter((a) => a.kind === "DOCUMENT" || a.kind === "OTHER" || a.kind === "ARCHIVE");
      if (docs.length === 0) return null;
      return <DocumentViewer docs={docs} />;
    }
    case "EMBED":
      return item.externalUrl ? <EmbedFrame url={item.externalUrl} title={item.title} /> : null;
    default:
      return null;
  }
}

/** Which attachments are already rendered by the primary viewer. */
export function viewerHandledIds(item: LearnItemDto): Set<string> {
  const ids = new Set<string>();
  for (const a of item.attachments) {
    if (item.type === "VIDEO" && a.kind === "VIDEO") ids.add(a.id);
    if (item.type === "AUDIO" && a.kind === "AUDIO") ids.add(a.id);
    if (item.type === "IMAGE" && a.kind === "IMAGE") ids.add(a.id);
    if (item.type === "DOCUMENT" && (a.kind === "DOCUMENT" || a.kind === "OTHER" || a.kind === "ARCHIVE")) ids.add(a.id);
  }
  return ids;
}

/** Renders attachments not shown by the primary viewer: media inline, other files as cards. */
export function ExtraAttachments({ attachments }: { attachments: MediaDto[] }) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => a.kind === "IMAGE");
  const audios = attachments.filter((a) => a.kind === "AUDIO");
  const videos = attachments.filter((a) => a.kind === "VIDEO");
  const files = attachments.filter((a) => !["IMAGE", "AUDIO", "VIDEO"].includes(a.kind));
  return (
    <section aria-label="Materials" className="grid gap-4">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Materials <span className="font-normal">({attachments.length})</span>
      </h2>
      {audios.map((a) => (
        <AudioPlayer key={a.id} src={a.url} title={a.fileName} downloadHref={downloadUrl(a)} compact />
      ))}
      {videos.map((v) => (
        <video key={v.id} controls preload="metadata" src={v.url} className="aspect-video w-full rounded-xl border bg-black" playsInline />
      ))}
      {images.length > 0 && <ImageGallery images={images} />}
      {files.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {files.map((f) => (
            <FileCard key={f.id} media={f} />
          ))}
        </div>
      )}
    </section>
  );
}
