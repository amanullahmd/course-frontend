import * as React from "react";

/**
 * Counts media uploads that are still running (e.g. a speaking answer being recorded), so the quiz player can hold
 * back the submit button until they finish instead of losing the recording.
 */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const uploadTracker = {
  begin() {
    pending += 1;
    emit();
  },
  end() {
    pending = Math.max(0, pending - 1);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => pending,
};

export function usePendingUploads(): number {
  return React.useSyncExternalStore(uploadTracker.subscribe, uploadTracker.snapshot, () => 0);
}
