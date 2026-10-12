import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered hooks/components between tests (no globals mode, so register it explicitly).
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
