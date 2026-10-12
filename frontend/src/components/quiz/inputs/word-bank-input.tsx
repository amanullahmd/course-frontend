"use client";

import * as React from "react";
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { SessionQuestion } from "@/lib/api/types";
import { blankIndexes, splitPrompt, type DraftAnswer } from "@/lib/exercises";
import { cn } from "@/lib/utils";
import { InlineHtml } from "@/components/course/rich-content";
import { ChipPreview, chipClass, useExerciseSensors } from "./dnd";

function BankChip({ id, text, onPick, announce }: { id: string; text: string; onPick: () => void; announce: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip:${id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onPick}
      aria-label={announce}
      className={cn(chipClass, "cursor-grab", isDragging && "opacity-40")}
    >
      {text}
    </button>
  );
}

function Slot({
  n,
  chip,
  active,
  onClick,
  label,
}: {
  n: number;
  chip: { id: string; text: string } | null;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `slot:${n}` });
  const drag = useDraggable({ id: `chip:${chip?.id ?? `empty-${n}`}`, disabled: !chip });
  return (
    <button
      ref={(node) => {
        dropRef(node);
        drag.setNodeRef(node);
      }}
      type="button"
      {...(chip ? { ...drag.attributes, ...drag.listeners } : {})}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active && !chip}
      className={cn(
        "mx-1 inline-flex h-10 min-w-24 items-center justify-center rounded-md border-b-2 px-3 align-baseline text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        chip ? "cursor-grab border-solid border-brand bg-brand-soft text-brand-strong" : "border-dashed border-brand/70 bg-brand-soft/20 text-muted-foreground",
        active && !chip && "border-solid bg-brand-soft/60 ring-2 ring-brand/40",
        isOver && "ring-2 ring-brand",
        drag.isDragging && "opacity-40",
      )}
    >
      {chip ? chip.text : <span aria-hidden>{n}</span>}
    </button>
  );
}

/** WORD_BANK: tap a word and then a blank (or drag it there). Words in a blank can be tapped to take them back. */
export function WordBankInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  const t = useTranslations("exercises");
  const blanks = React.useMemo(() => blankIndexes(question.prompt), [question.prompt]);
  const parts = React.useMemo(() => splitPrompt(question.prompt), [question.prompt]);
  const sensors = useExerciseSensors();
  const [active, setActive] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const { setNodeRef: bankRef, isOver: overBank } = useDroppable({ id: "bank" });

  const chips = new Map(question.options.map((o) => [o.id, o]));
  const placed = blanks.map((n) => {
    const id = value.blanks[String(n)];
    return id && chips.has(id) ? { id, text: chips.get(id)!.text } : null;
  });
  const used = new Set(placed.flatMap((p) => (p ? [p.id] : [])));
  const free = question.options.filter((o) => !used.has(o.id));

  const place = (chipId: string, blank: number) => {
    const next = { ...value.blanks };
    for (const [k, v] of Object.entries(next)) if (v === chipId) delete next[k];
    next[String(blank)] = chipId;
    onChange({ ...value, blanks: next });
    const nextEmpty = blanks.find((n) => n !== blank && !next[String(n)]);
    setActive(nextEmpty ?? null);
  };
  const takeBack = (blank: number) => {
    const next = { ...value.blanks };
    delete next[String(blank)];
    onChange({ ...value, blanks: next });
    setActive(blank);
  };
  const pick = (chipId: string) => {
    const target = active !== null && !value.blanks[String(active)] ? active : blanks.find((n) => !value.blanks[String(n)]);
    if (target !== undefined) place(chipId, target);
  };

  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id).replace("chip:", ""));
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const chipId = String(e.active.id).replace("chip:", "");
    const over = e.over ? String(e.over.id) : null;
    if (!over || !chips.has(chipId)) return;
    if (over === "bank") {
      const entry = Object.entries(value.blanks).find(([, v]) => v === chipId);
      if (entry) takeBack(Number(entry[0]));
    } else if (over.startsWith("slot:")) {
      place(chipId, Number(over.slice(5)));
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid gap-5">
        <div id={`q-${question.id}-prompt`} className="text-lg leading-[3rem] font-medium [&_p]:inline">
          {parts.map((p, i) =>
            p.kind === "text" ? (
              <InlineHtml key={i} html={p.text} />
            ) : (
              <Slot
                key={i}
                n={p.index}
                chip={placed[blanks.indexOf(p.index)] ?? null}
                active={active === p.index}
                label={
                  placed[blanks.indexOf(p.index)]
                    ? t("slotFilled", { n: p.index, word: placed[blanks.indexOf(p.index)]!.text })
                    : t("slotEmpty", { n: p.index })
                }
                onClick={() => (placed[blanks.indexOf(p.index)] ? takeBack(p.index) : setActive(p.index))}
              />
            ),
          )}
        </div>
        <div
          ref={bankRef}
          className={cn("rounded-xl border border-dashed bg-muted/30 p-3 transition-colors", overBank && "border-brand bg-brand-soft/30")}
          role="group"
          aria-label={t("wordBank")}
        >
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("wordBank")}</p>
          <div className="flex flex-wrap gap-2">
            {free.map((o) => (
              <BankChip key={o.id} id={o.id} text={o.text} onPick={() => pick(o.id)} announce={o.text} />
            ))}
            {free.length === 0 && <p className="text-sm text-muted-foreground">{t("wordBankPlaced")}</p>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("wordBankHint")}</p>
        </div>
      </div>
      <DragOverlay>{dragging && chips.has(dragging) ? <ChipPreview>{chips.get(dragging)!.text}</ChipPreview> : null}</DragOverlay>
    </DndContext>
  );
}
