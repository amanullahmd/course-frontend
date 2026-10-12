"use client";

import * as React from "react";
import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

/**
 * Pointer sensors for the exercise inputs. Touch needs a short press before a drag starts, so scrolling a page full
 * of draggable chips still works on a phone; every drag also has a tap/keyboard alternative.
 */
export function useExerciseSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export const chipClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg border bg-card px-3.5 py-1.5 text-[15px] font-medium shadow-xs transition-[border-color,background-color,box-shadow] select-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** The chip that follows the pointer while dragging. */
export function ChipPreview({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn(chipClass, "cursor-grabbing border-brand bg-brand-soft text-brand-strong shadow-lg ring-2 ring-brand/40", className)}>{children}</span>;
}
