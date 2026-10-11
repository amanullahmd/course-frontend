"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { MediaDto } from "@/lib/api/types";
import { downloadUrl } from "@/lib/api/media";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function ImageGallery({ images }: { images: MediaDto[] }) {
  const t = useTranslations("learn");
  const tc = useTranslations("common");
  const [index, setIndex] = React.useState<number | null>(null);
  if (images.length === 0) return null;
  const current = index !== null ? images[index] : null;
  const go = (delta: number) => setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length));

  return (
    <>
      <div className={cn("grid gap-3", images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
              images.length === 1 ? "max-h-[70vh]" : "aspect-[4/3]",
            )}
            aria-label={t("openImage", { name: img.fileName })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed media URL */}
            <img
              src={img.url}
              alt={img.fileName}
              loading="lazy"
              className={cn(
                "transition-transform duration-300 group-hover:scale-[1.02]",
                images.length === 1 ? "mx-auto max-h-[70vh] w-auto object-contain" : "size-full object-cover",
              )}
            />
          </button>
        ))}
      </div>
      <Dialog open={current !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent
          className="max-w-[min(96vw,1200px)] gap-3 bg-black/95 p-3 text-white sm:p-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
        >
          <DialogTitle className="truncate pr-8 text-sm font-medium text-white">{current?.fileName}</DialogTitle>
          <DialogDescription className="sr-only">{t("imageViewer")}</DialogDescription>
          {current && (
            <div className="relative grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed media URL */}
              <img src={current.url} alt={current.fileName} className="max-h-[78vh] w-auto rounded-lg object-contain" />
              {images.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} className="absolute left-2 grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20" aria-label={t("prevImage")}>
                    <ChevronLeft />
                  </button>
                  <button type="button" onClick={() => go(1)} className="absolute right-2 grid size-10 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20" aria-label={t("nextImage")}>
                    <ChevronRight />
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-white/70">
            <span className="tabular-nums">{index !== null && `${index + 1} / ${images.length}`}</span>
            {current && (
              <a href={downloadUrl(current)} className="flex items-center gap-1 hover:text-white">
                <Download className="size-3.5" /> {tc("download")}
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
