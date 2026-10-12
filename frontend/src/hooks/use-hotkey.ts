"use client";

import * as React from "react";

/**
 * Registers a keyboard shortcut. `combo` like "mod+s", "alt+arrowright", "j".
 * `mod` = Cmd on macOS, Ctrl elsewhere.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean; allowInInputs?: boolean } = {},
) {
  const { enabled = true, allowInInputs = false } = options;
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needMod = parts.includes("mod");
    const needAlt = parts.includes("alt");
    const needShift = parts.includes("shift");
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing && !allowInInputs && !needMod) return;
      const mod = event.metaKey || event.ctrlKey;
      if (needMod !== mod || needAlt !== event.altKey || needShift !== event.shiftKey) return;
      if (event.key.toLowerCase() !== key) return;
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, enabled, allowInInputs]);
}
