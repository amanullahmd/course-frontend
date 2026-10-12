"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { ContentItemDto, CourseDto, ModuleDto } from "@/lib/api/types";
import {
  useCreateModule,
  useDeleteItem,
  useDeleteModule,
  useOrderItems,
  useOrderModules,
  usePublishItem,
  usePublishModule,
  useUpdateModule,
} from "@/hooks/queries/instructor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ItemRowContent, type ItemRowActions } from "./item-row";
import { ModuleCardBody, SortableModuleCard, type ModuleActions } from "./module-card";

type DragKind = "module" | "item";
const parseId = (id: string | number) => {
  const [kind, raw] = String(id).split(":");
  return { kind, id: raw };
};

function sortTree(modules: ModuleDto[]): ModuleDto[] {
  return [...modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m, items: [...m.items].sort((a, b) => a.position - b.position) }));
}

/** Only consider droppables of the same kind as the dragged element. */
const collision: CollisionDetection = (args) => {
  const type = args.active.data.current?.type as DragKind | undefined;
  const droppableContainers = args.droppableContainers.filter((c) => {
    const t = c.data.current?.type;
    return type === "module" ? t === "module" : t === "item" || t === "container";
  });
  return closestCorners({ ...args, droppableContainers });
};

function AddModuleInline({ courseId, autoOpen }: { courseId: string; autoOpen?: boolean }) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(!!autoOpen);
  const [title, setTitle] = React.useState("");
  const create = useCreateModule(courseId);
  if (!open) {
    return (
      <Button variant="outline" className="w-full border-dashed py-6 text-muted-foreground hover:text-foreground" onClick={() => setOpen(true)}>
        <Plus /> {t("builder.addModule")}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-dashed bg-card p-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        create.mutate(
          { title: title.trim(), description: null },
          {
            onSuccess: () => {
              setTitle("");
              toast.success(t("builder.moduleAdded"));
            },
          },
        );
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("builder.moduleTitlePlaceholder")}
        aria-label={t("builder.newModuleTitle")}
        maxLength={200}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      <div className="flex gap-2">
        <Button type="submit" loading={create.isPending} disabled={!title.trim()}>
          {t("common.add")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

export function CurriculumBoard({ course }: { course: CourseDto }) {
  const t = useTranslations();
  const serverModules = React.useMemo(() => sortTree(course.modules), [course.modules]);
  const [local, setLocal] = React.useState<ModuleDto[] | null>(null);
  const modules = local ?? serverModules;
  const [active, setActive] = React.useState<{ kind: DragKind; id: string } | null>(null);
  const [originModuleId, setOriginModuleId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [editing, setEditing] = React.useState<ModuleDto | null>(null);
  const [deletingModule, setDeletingModule] = React.useState<ModuleDto | null>(null);
  const [deletingItem, setDeletingItem] = React.useState<ContentItemDto | null>(null);

  const orderModules = useOrderModules(course.id);
  const orderItems = useOrderItems(course.id);
  const publishModule = usePublishModule(course.id);
  const publishItem = usePublishItem(course.id);
  const updateModule = useUpdateModule(course.id);
  const deleteModule = useDeleteModule(course.id);
  const deleteItem = useDeleteItem(course.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findModuleOfItem = (list: ModuleDto[], itemId: string) => list.find((m) => m.items.some((i) => i.id === itemId));

  const moveItem = React.useCallback(
    (itemId: string, toModuleId: string) => {
      const source = findModuleOfItem(serverModules, itemId);
      const target = serverModules.find((m) => m.id === toModuleId);
      const item = source?.items.find((i) => i.id === itemId);
      if (!source || !target || !item) return;
      const next = serverModules.map((m) => {
        if (m.id === source.id) return { ...m, items: m.items.filter((i) => i.id !== itemId) };
        if (m.id === target.id) return { ...m, items: [...m.items, { ...item, moduleId: target.id }] };
        return m;
      });
      const ids = [...target.items.map((i) => i.id), itemId];
      orderItems.mutate(
        { moduleId: target.id, ids, optimisticModules: next },
        { onSuccess: () => toast.success(t("builder.movedTo", { title: target.title })) },
      );
    },
    [orderItems, serverModules, t],
  );

  const itemActions: ItemRowActions = {
    courseId: course.id,
    modules,
    onPublish: (id, body) => publishItem.mutateAsync({ id, body }),
    onMove: moveItem,
    onDelete: setDeletingItem,
  };
  const moduleActions: ModuleActions = {
    onPublish: (id, body) => publishModule.mutateAsync({ id, body }),
    onEdit: setEditing,
    onDelete: setDeletingModule,
  };

  const onDragStart = ({ active: a }: DragStartEvent) => {
    const parsed = parseId(a.id);
    setActive({ kind: parsed.kind as DragKind, id: parsed.id });
    setLocal(serverModules.map((m) => ({ ...m, items: [...m.items] })));
    if (parsed.kind === "item") setOriginModuleId(findModuleOfItem(serverModules, parsed.id)?.id ?? null);
  };

  const onDragOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || !local) return;
    const act = parseId(a.id);
    if (act.kind !== "item") return;
    const overParsed = parseId(over.id);
    const from = findModuleOfItem(local, act.id);
    const to = overParsed.kind === "item" ? findModuleOfItem(local, overParsed.id) : local.find((m) => m.id === overParsed.id);
    if (!from || !to || from.id === to.id) return;
    const item = from.items.find((i) => i.id === act.id);
    if (!item) return;
    const overIndex = overParsed.kind === "item" ? to.items.findIndex((i) => i.id === overParsed.id) : to.items.length;
    const insertAt = overIndex < 0 ? to.items.length : overIndex;
    setLocal(
      local.map((m) => {
        if (m.id === from.id) return { ...m, items: m.items.filter((i) => i.id !== act.id) };
        if (m.id === to.id) {
          const items = [...m.items];
          items.splice(insertAt, 0, { ...item, moduleId: to.id });
          return { ...m, items };
        }
        return m;
      }),
    );
  };

  const finish = () => {
    setActive(null);
    setOriginModuleId(null);
  };

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    const act = parseId(a.id);
    const current = local ?? serverModules;
    if (!over) {
      setLocal(null);
      return finish();
    }
    const overParsed = parseId(over.id);

    if (act.kind === "module") {
      const oldIndex = current.findIndex((m) => m.id === act.id);
      const newIndex = current.findIndex((m) => m.id === overParsed.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        setLocal(null);
        return finish();
      }
      const next = arrayMove(current, oldIndex, newIndex);
      setLocal(next);
      orderModules.mutate(next.map((m) => m.id), { onSettled: () => setLocal(null) });
      return finish();
    }

    // Item
    let next = current;
    const container = findModuleOfItem(current, act.id);
    if (container && overParsed.kind === "item") {
      const oldIndex = container.items.findIndex((i) => i.id === act.id);
      const newIndex = container.items.findIndex((i) => i.id === overParsed.id);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        next = current.map((m) => (m.id === container.id ? { ...m, items: arrayMove(m.items, oldIndex, newIndex) } : m));
      }
    }
    const target = findModuleOfItem(next, act.id);
    const original = serverModules.find((m) => m.id === target?.id);
    const unchanged =
      !target ||
      (target.id === originModuleId &&
        original &&
        original.items.map((i) => i.id).join() === target.items.map((i) => i.id).join());
    if (unchanged || !target) {
      setLocal(null);
      return finish();
    }
    setLocal(next);
    orderItems.mutate(
      { moduleId: target.id, ids: target.items.map((i) => i.id), optimisticModules: next },
      { onSettled: () => setLocal(null) },
    );
    finish();
  };

  const activeModule = active?.kind === "module" ? modules.find((m) => m.id === active.id) : undefined;
  const activeItem = active?.kind === "item" ? modules.flatMap((m) => m.items).find((i) => i.id === active.id) : undefined;

  if (modules.length === 0) {
    return (
      <div className="grid gap-4">
        <EmptyState
          icon={Layers}
          title={t("builder.firstModuleTitle")}
          description={t("builder.firstModuleText")}
        />
        <AddModuleInline courseId={course.id} autoOpen />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setLocal(null);
          finish();
        }}
      >
        <SortableContext items={modules.map((m) => `module:${m.id}`)} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-4" aria-label={t("builder.modulesAria")}>
            {modules.map((m, index) => (
              <SortableModuleCard
                key={m.id}
                module={m}
                index={index}
                itemActions={itemActions}
                moduleActions={moduleActions}
                collapsed={!!collapsed[m.id] || active?.kind === "module"}
                onToggle={() => setCollapsed((c) => ({ ...c, [m.id]: !c[m.id] }))}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {activeModule ? (
            <ModuleCardBody module={activeModule} index={modules.indexOf(activeModule)} collapsed dragging />
          ) : activeItem ? (
            <ItemRowContent item={activeItem} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddModuleInline courseId={course.id} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const title = String(data.get("title") ?? "").trim();
                if (!title) return;
                updateModule.mutate(
                  { id: editing.id, body: { title, description: String(data.get("description") ?? "").trim() || null } },
                  {
                    onSuccess: () => {
                      setEditing(null);
                      toast.success(t("builder.moduleUpdated"));
                    },
                  },
                );
              }}
            >
              <DialogHeader>
                <DialogTitle>{t("builder.editModule")}</DialogTitle>
                <DialogDescription>{t("builder.editModuleText")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="module-title">{t("builder.title")}</Label>
                <Input id="module-title" name="title" defaultValue={editing.title} required maxLength={200} autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="module-description">{t("builder.description")}</Label>
                <Textarea id="module-description" name="description" defaultValue={editing.description ?? ""} rows={4} maxLength={2000} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={updateModule.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingModule}
        onOpenChange={(o) => !o && setDeletingModule(null)}
        title={t("builder.deleteTitle", { title: deletingModule?.title ?? "" })}
        description={t("builder.deleteModuleText", { count: deletingModule?.items.length ?? 0 })}
        confirmLabel={t("builder.deleteModule")}
        destructive
        loading={deleteModule.isPending}
        onConfirm={() =>
          deletingModule &&
          deleteModule.mutate(deletingModule.id, {
            onSuccess: () => {
              setDeletingModule(null);
              toast.success(t("builder.moduleDeleted"));
            },
          })
        }
      />
      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(o) => !o && setDeletingItem(null)}
        title={t("builder.deleteTitle", { title: deletingItem?.title ?? "" })}
        description={t("builder.deleteItemText")}
        confirmLabel={t("common.delete")}
        destructive
        loading={deleteItem.isPending}
        onConfirm={() =>
          deletingItem &&
          deleteItem.mutate(deletingItem.id, {
            onSuccess: () => {
              setDeletingItem(null);
              toast.success(t("builder.itemDeleted"));
            },
          })
        }
      />
    </div>
  );
}
