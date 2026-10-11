"use client";

import * as React from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, X } from "lucide-react";
import type { MediaDto } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { cn, formatBytes } from "@/lib/utils";
import { useUploads } from "@/hooks/use-uploads";
import { fileStyle, FileTypeIcon, useFileLabel } from "@/components/course/file-type-icon";
import { Button } from "@/components/ui/button";
import { FileDropzone, UploadProgressList } from "@/components/ui/file-dropzone";
import { Tooltip } from "@/components/ui/tooltip";

function AttachmentRow({ media, onRemove }: { media: MediaDto; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  const t = useTranslations("attachments");
  const style = fileStyle(media.fileName, media.contentType, media.kind);
  const label = useFileLabel()(style);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-3 rounded-lg border bg-card p-2 pr-2.5", isDragging && "z-10 shadow-lg ring-2 ring-brand")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
        aria-label={t("reorder", { name: media.fileName })}
      >
        <GripVertical className="size-4" />
      </button>
      {media.kind === "IMAGE" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed media URL
        <img src={media.url} alt="" className="size-10 shrink-0 rounded-lg border object-cover" />
      ) : (
        <FileTypeIcon name={media.fileName} contentType={media.contentType} kind={media.kind} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={media.fileName}>
          {media.fileName}
        </p>
        <p className="text-xs text-muted-foreground">
          {label} · {formatBytes(media.sizeBytes)}
        </p>
      </div>
      {media.kind === "AUDIO" && <audio src={media.url} controls preload="none" className="hidden h-8 w-48 lg:block" />}
      <Tooltip content={t("preview")}>
        <Button variant="ghost" size="icon-xs" asChild>
          <a href={media.url} target="_blank" rel="noopener noreferrer" aria-label={t("previewName", { name: media.fileName })}>
            <ExternalLink />
          </a>
        </Button>
      </Tooltip>
      <Tooltip content={t("remove")}>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} aria-label={t("removeName", { name: media.fileName })} className="hover:text-destructive">
          <X />
        </Button>
      </Tooltip>
    </li>
  );
}

/** Drag & drop multi-file uploader + sortable attachment list. */
export function AttachmentsManager({
  value,
  onChange,
  onAppend,
  accept,
  hint,
}: {
  value: MediaDto[];
  onChange: (value: MediaDto[]) => void;
  /** Called for each finished upload; must append to the latest value. */
  onAppend: (media: MediaDto) => void;
  accept?: string;
  hint?: string;
}) {
  const t = useTranslations("attachments");
  const { uploads, upload, cancel, retry, dismiss } = useUploads({ onUploaded: (media) => onAppend(media) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = value.findIndex((m) => m.id === active.id);
    const to = value.findIndex((m) => m.id === over.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(value, from, to));
  };

  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={value.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid gap-2" aria-label={t("list")}>
              {value.map((m) => (
                <AttachmentRow key={m.id} media={m} onRemove={() => onChange(value.filter((x) => x.id !== m.id))} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <UploadProgressList uploads={uploads} onCancel={cancel} onRetry={retry} onDismiss={dismiss} />
      <FileDropzone onFiles={upload} accept={accept} hint={hint} compact={value.length > 0} />
    </div>
  );
}
