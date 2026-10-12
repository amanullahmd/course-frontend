"use client";

import * as React from "react";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SessionQuestion } from "@/lib/api/types";
import { arrayMove, moveBy, reconcileOrder, type DraftAnswer } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useExerciseSensors } from "./dnd";

function Item({
  id,
  text,
  index,
  total,
  onMove,
}: {
  id: string;
  text: string;
  index: number;
  total: number;
  onMove: (delta: number) => void;
}) {
  const t = useTranslations("exercises");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-xl border bg-card p-2 pr-2.5 shadow-xs", isDragging && "relative z-10 shadow-lg ring-2 ring-brand")}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("dragItem", { item: text })}
        className="grid size-10 shrink-0 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <GripVertical className="size-5" />
      </button>
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums" aria-hidden>
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-medium" aria-label={t("orderPosition", { n: index + 1, total, item: text })}>
        {text}
      </span>
      <Button type="button" variant="outline" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveUp", { item: text })}>
        <ChevronUp />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={t("moveDown", { item: text })}>
        <ChevronDown />
      </Button>
    </li>
  );
}

/** ORDERING: a sortable list; drag by the handle, or use the arrow buttons / keyboard. */
export function OrderingInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  const t = useTranslations("exercises");
  const sensors = useExerciseSensors();
  const ids = React.useMemo(() => question.options.map((o) => o.id), [question.options]);
  const order = React.useMemo(() => reconcileOrder(value.order, ids), [value.order, ids]);
  // What is on screen is the answer: store the displayed order as soon as the question is shown.
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  });
  const needsInit = value.order.length !== ids.length || value.order.some((id, i) => id !== order[i]);
  React.useEffect(() => {
    if (needsInit) onChange({ ...valueRef.current, order });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the question or its saved order changes
  }, [needsInit, order.join(",")]);
  const text = new Map(question.options.map((o) => [o.id, o.text]));
  const commit = (next: string[]) => onChange({ ...value, order: next });
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    commit(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  };
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{t("orderHint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="grid gap-2" aria-labelledby={`q-${question.id}-prompt`}>
            {order.map((id, i) => (
              <Item key={id} id={id} text={text.get(id) ?? ""} index={i} total={order.length} onMove={(d) => commit(moveBy(order, i, d))} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
