"use client";

import * as React from "react";
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { SessionQuestion } from "@/lib/api/types";
import type { DraftAnswer } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui/input";
import { ChipPreview, chipClass, useExerciseSensors } from "./dnd";

function PoolChip({ id, text, onPick }: { id: string; text: string; onPick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `target:${id}` });
  return (
    <button ref={setNodeRef} type="button" {...attributes} {...listeners} onClick={onPick} className={cn(chipClass, "cursor-grab", isDragging && "opacity-40")}>
      {text}
    </button>
  );
}

function Row({
  question,
  left,
  value,
  targets,
  used,
  onSet,
}: {
  question: SessionQuestion;
  left: { id: string; text: string };
  value: string;
  targets: { id: string; text: string }[];
  used: Set<string>;
  onSet: (rightId: string) => void;
}) {
  const t = useTranslations("exercises");
  const { setNodeRef, isOver } = useDroppable({ id: `row:${left.id}` });
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "grid gap-2 rounded-xl border bg-card p-3 transition-colors sm:grid-cols-[1fr_minmax(11rem,18rem)] sm:items-center",
        isOver && "border-brand bg-brand-soft/30",
        value && "border-brand/40",
      )}
    >
      <span id={`q-${question.id}-l-${left.id}`} className="font-medium">
        {left.text}
      </span>
      <select
        value={value}
        onChange={(e) => onSet(e.target.value)}
        aria-label={t("matchFor", { item: left.text })}
        className={cn(inputClass, "h-11 cursor-pointer text-base")}
      >
        <option value="">{t("matchChoose")}</option>
        {targets.map((o) => (
          <option key={o.id} value={o.id} disabled={used.has(o.id) && o.id !== value}>
            {o.text}
          </option>
        ))}
      </select>
    </li>
  );
}

/** MATCHING: one choice per left item (a plain select, works everywhere); on a computer the free partners can also be dragged. */
export function MatchingInput({
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
  const [dragging, setDragging] = React.useState<string | null>(null);
  const targets = question.matchTargets ?? [];
  const used = new Set(Object.values(value.pairs));
  const free = targets.filter((o) => !used.has(o.id));
  const set = (leftId: string, rightId: string) => {
    const pairs = { ...value.pairs };
    if (rightId) {
      for (const [k, v] of Object.entries(pairs)) if (v === rightId) delete pairs[k];
      pairs[leftId] = rightId;
    } else delete pairs[leftId];
    onChange({ ...value, pairs });
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const over = e.over ? String(e.over.id) : null;
    if (over?.startsWith("row:")) set(over.slice(4), String(e.active.id).replace("target:", ""));
  };
  const firstEmpty = question.options.find((o) => !value.pairs[o.id]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id).replace("target:", ""))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-4">
        <p className="text-xs text-muted-foreground">{t("matchHint")}</p>
        <ul className="grid gap-2.5">
          {question.options.map((left) => (
            <Row key={left.id} question={question} left={left} value={value.pairs[left.id] ?? ""} targets={targets} used={used} onSet={(r) => set(left.id, r)} />
          ))}
        </ul>
        <div className="rounded-xl border border-dashed bg-muted/30 p-3" role="group" aria-label={t("matchPool")}>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("matchPool")}</p>
          <div className="flex flex-wrap gap-2">
            {free.map((o) => (
              <PoolChip key={o.id} id={o.id} text={o.text} onPick={() => firstEmpty && set(firstEmpty.id, o.id)} />
            ))}
            {free.length === 0 && <p className="text-sm text-muted-foreground">{t("wordBankPlaced")}</p>}
          </div>
        </div>
      </div>
      <DragOverlay>{dragging ? <ChipPreview>{targets.find((o) => o.id === dragging)?.text}</ChipPreview> : null}</DragOverlay>
    </DndContext>
  );
}
