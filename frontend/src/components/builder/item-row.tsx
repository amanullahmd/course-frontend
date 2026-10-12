"use client";

import * as React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, Clock, Ellipsis, GripVertical, ListChecks, Paperclip, Pencil, Trash } from "lucide-react";
import type { ContentItemDto, ModuleDto, PublicationRequest } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useMinutes } from "@/hooks/use-minutes";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { VisibilityBadge } from "@/components/course/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PublicationPopover, PublishSwitch } from "./publication-control";

export interface ItemRowActions {
  courseId: string;
  modules: ModuleDto[];
  onPublish: (id: string, body: PublicationRequest) => Promise<unknown>;
  onMove: (itemId: string, toModuleId: string) => void;
  onDelete: (item: ContentItemDto) => void;
}

export function ItemRowContent({
  item,
  actions,
  handle,
  dragging,
}: {
  item: ContentItemDto;
  actions?: ItemRowActions;
  handle?: React.ReactNode;
  dragging?: boolean;
}) {
  const t = useTranslations();
  const minutes = useMinutes();
  const href = actions ? `/instructor/courses/${actions.courseId}/items/${item.id}` : "#";
  return (
    <div
      className={cn(
        "group/item flex items-center gap-2 rounded-lg border bg-card px-2 py-2 transition-shadow sm:gap-3",
        dragging ? "shadow-lg ring-2 ring-brand" : "hover:shadow-sm",
      )}
    >
      {handle ?? <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />}
      <ItemTypeIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <Link href={href} className="line-clamp-2 text-sm font-medium [overflow-wrap:anywhere] hover:underline sm:line-clamp-1">
          {item.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {actions && (item.visibility === "SCHEDULED" || item.visibility === "EXPIRED") && (
            <VisibilityBadge
              visibility={item.visibility}
              publishAt={item.publishAt}
              unpublishAt={item.unpublishAt}
              compact
              className="md:hidden"
            />
          )}
          {item.attachments.length > 0 && (
            <span className="flex items-center gap-1" title={t("builder.attachments")}>
              <Paperclip className="size-3" /> {item.attachments.length}
            </span>
          )}
          {item.assessment && (
            <span className="flex items-center gap-1" title={t("builder.questions")}>
              <ListChecks className="size-3" /> {t("builder.qShort", { count: item.assessment.questionCount, points: item.assessment.totalPoints })}
            </span>
          )}
          {item.durationMinutes ? (
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {minutes(item.durationMinutes)}
            </span>
          ) : null}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">
          <VisibilityBadge
            visibility={item.visibility}
            publishAt={item.publishAt}
            unpublishAt={item.unpublishAt}
            compact
            className="hidden md:inline-flex"
          />
          <PublishSwitch entity={item} entityLabel={item.title} onSubmit={(body) => void actions.onPublish(item.id, body).catch(() => undefined)} />
          <PublicationPopover entity={item} entityLabel="lesson" trigger="icon" onSubmit={(body) => actions.onPublish(item.id, body)} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t("builder.itemActions", { title: item.title })}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={href}>
                  <Pencil /> {t("common.edit")}
                </Link>
              </DropdownMenuItem>
              {actions.modules.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightLeft /> {t("builder.moveTo")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {actions.modules
                      .filter((m) => !m.items.some((i) => i.id === item.id))
                      .map((m) => (
                        <DropdownMenuItem key={m.id} onSelect={() => actions.onMove(item.id, m.id)}>
                          <span className="truncate">{m.title}</span>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => actions.onDelete(item)}>
                <Trash /> {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

export function SortableItemRow({ item, actions }: { item: ContentItemDto; actions: ItemRowActions }) {
  const t = useTranslations("builder");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
    data: { type: "item", itemId: item.id },
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <ItemRowContent
        item={item}
        actions={actions}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
            aria-label={t("dragItem", { title: item.title })}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}
