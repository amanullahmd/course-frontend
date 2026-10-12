"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { arrayMove, moveBy } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newKey, type DraftOption, type DraftQuestion } from "../question-model";

function Row({
  o,
  index,
  total,
  onText,
  onMove,
  onRemove,
}: {
  o: DraftOption;
  index: number;
  total: number;
  onText: (text: string) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("exercises.editor");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: o.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-1.5 rounded-lg", isDragging && "relative z-10 bg-card shadow-lg ring-2 ring-brand")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
        aria-label={t("itemN", { n: index + 1 })}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums" aria-hidden>
        {index + 1}
      </span>
      <Input value={o.text} onChange={(e) => onText(e.target.value)} aria-label={t("itemN", { n: index + 1 })} placeholder={t("itemN", { n: index + 1 })} lang="de" />
      <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveItemUp", { n: index + 1 })}>
        <ChevronUp />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={t("moveItemDown", { n: index + 1 })}>
        <ChevronDown />
      </Button>
      <Button type="button" variant="ghost" size="icon-xs" disabled={total <= 2} onClick={onRemove} aria-label={t("removeItem", { n: index + 1 })}>
        <X />
      </Button>
    </li>
  );
}

/** Items of an ORDERING question in their correct order (learners see them shuffled). */
export function OrderingEditor({ q, set }: { q: DraftQuestion; set: (patch: Partial<DraftQuestion>) => void }) {
  const t = useTranslations("exercises.editor");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    set({ options: arrayMove(q.options, q.options.findIndex((o) => o.key === active.id), q.options.findIndex((o) => o.key === over.id)) });
  };
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{t("items")}</legend>
      <p className="mb-1 text-xs text-muted-foreground">{t("itemsHint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={q.options.map((o) => o.key)} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2">
            {q.options.map((o, i) => (
              <Row
                key={o.key}
                o={o}
                index={i}
                total={q.options.length}
                onText={(text) => set({ options: q.options.map((x) => (x.key === o.key ? { ...x, text } : x)) })}
                onMove={(d) => set({ options: moveBy(q.options, i, d) })}
                onRemove={() => set({ options: q.options.filter((x) => x.key !== o.key) })}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {q.options.length < 12 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() => set({ options: [...q.options, { key: newKey(), text: "", correct: false, position: q.options.length }] })}
        >
          <Plus /> {t("addItem")}
        </Button>
      )}
    </fieldset>
  );
}
