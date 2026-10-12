import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (Vitest + jsdom). Playwright e2e specs live in e2e/ and run with `npm run test:e2e`.
// Dates are formatted in the local time zone, so pin it to keep the assertions deterministic.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
