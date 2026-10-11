"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Ellipsis, GripVertical, Inbox, Pencil, Trash } from "lucide-react";
import type { ModuleDto, PublicationRequest } from "@/lib/api/types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useMinutes } from "@/hooks/use-minutes";
import { VisibilityBadge } from "@/components/course/badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddContentMenu } from "./add-content";
import { SortableItemRow, type ItemRowActions } from "./item-row";
import { PublicationPopover, PublishSwitch } from "./publication-control";

export interface ModuleActions {
  onPublish: (id: string, body: PublicationRequest) => Promise<unknown>;
  onEdit: (module: ModuleDto) => void;
  onDelete: (module: ModuleDto) => void;
}

function ItemsDropArea({ module, children }: { module: ModuleDto; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${module.id}`, data: { type: "container", moduleId: module.id } });
  return (
    <div ref={setNodeRef} className={cn("rounded-lg transition-colors", isOver && module.items.length === 0 && "bg-brand-soft/40")}>
      {children}
    </div>
  );
}

export function ModuleCardBody({
  module,
  index,
  itemActions,
  moduleActions,
  collapsed,
  onToggle,
  handle,
  dragging,
}: {
  module: ModuleDto;
  index: number;
  itemActions?: ItemRowActions;
  moduleActions?: ModuleActions;
  collapsed: boolean;
  onToggle?: () => void;
  handle?: React.ReactNode;
  dragging?: boolean;
}) {
  const t = useTranslations();
  const minutesLabel = useMinutes();
  const minutes = module.items.reduce((s, i) => s + (i.durationMinutes ?? 0), 0);
  return (
    <div className={cn("rounded-xl border bg-sidebar shadow-xs", dragging && "shadow-xl ring-2 ring-brand")}>
      <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        {handle ?? <GripVertical className="size-4 text-muted-foreground/50" />}
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={!collapsed}
          aria-label={t("builder.toggleModule", { title: module.title })}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-card text-sm font-semibold tabular-nums">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{module.title}</span>
            <span className="block text-xs text-muted-foreground">
              {t("course.itemsCount", { count: module.items.length })}
              {minutes > 0 && ` · ${minutesLabel(minutes)}`}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
        </button>
        {moduleActions && (
          <div className="flex shrink-0 items-center gap-1.5">
            <VisibilityBadge visibility={module.visibility} publishAt={module.publishAt} unpublishAt={module.unpublishAt} compact className="hidden md:inline-flex" />
            <PublishSwitch entity={module} entityLabel={module.title} onSubmit={(b) => void moduleActions.onPublish(module.id, b).catch(() => undefined)} />
            <PublicationPopover entity={module} entityLabel="module" trigger="icon" onSubmit={(b) => moduleActions.onPublish(module.id, b)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={t("builder.moduleActions", { title: module.title })}>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => moduleActions.onEdit(module)}>
                  <Pencil /> {t("builder.renameDescribe")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => moduleActions.onDelete(module)}>
                  <Trash /> {t("builder.deleteModule")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="border-t px-2 pt-2 pb-2 sm:px-3">
          {module.description && <p className="px-1 pb-2 text-[13px] text-muted-foreground">{module.description}</p>}
          {itemActions ? (
            <ItemsDropArea module={module}>
              <SortableContext items={module.items.map((i) => `item:${i.id}`)} strategy={verticalListSortingStrategy}>
                <ul className="grid min-h-12 gap-1.5" aria-label={t("builder.itemsIn", { title: module.title })}>
                  {module.items.map((item) => (
                    <SortableItemRow key={item.id} item={item} actions={itemActions} />
                  ))}
                  {module.items.length === 0 && (
                    <li className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-5 text-[13px] text-muted-foreground">
                      <Inbox className="size-4" /> {t("builder.dropHere")}
                    </li>
                  )}
                </ul>
              </SortableContext>
            </ItemsDropArea>
          ) : (
            <div className="h-10" />
          )}
          {itemActions && (
            <div className="mt-1.5">
              <AddContentMenu courseId={itemActions.courseId} moduleId={module.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SortableModuleCard(props: Omit<React.ComponentProps<typeof ModuleCardBody>, "handle" | "dragging">) {
  const t = useTranslations("builder");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `module:${props.module.id}`,
    data: { type: "module", moduleId: props.module.id },
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      <ModuleCardBody
        {...props}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
            aria-label={t("dragModule", { title: props.module.title })}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </li>
  );
}
