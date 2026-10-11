"use client";

import * as React from "react";

let now = Date.now();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(callback: () => void) {
  subscribers.add(callback);
  now = Date.now();
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      subscribers.forEach((s) => s());
    }, 1000);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/**
 * Current time in ms, ticking every second. Returns 0 during server rendering
 * so callers can render a neutral state until hydration.
 */
export function useNow(): number {
  return React.useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start of the current local day in ms (0 on the server); re-renders only when the day changes. */
export function useToday(): number {
  return React.useSyncExternalStore(
    subscribe,
    () => startOfDayMs(now),
    () => 0,
  );
}
