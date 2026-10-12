import { mkdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests (e2e/). Playwright starts both servers unless they are already running:
 *   1. the backend jar (dev profile, seeded H2 database, e-mails logged, rate limits off), and
 *   2. the production build of this app (`next start`, so run `npm run build` first with
 *      NEXT_PUBLIC_API_URL=http://localhost:<E2E_API_PORT>).
 *
 *   cd backend && ./mvnw -DskipTests package
 *   cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8080 npm run build && npm run test:e2e
 *
 * Environment: E2E_API_PORT (8080), E2E_WEB_PORT (3000), E2E_BACKEND_JAR (../backend/target/sprachweg-backend-*.jar),
 * PW_CHROMIUM_PATH (use a preinstalled Chromium instead of `npx playwright install chromium`).
 */
const apiPort = Number(process.env.E2E_API_PORT ?? 8080);
const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
const backendJar = path.resolve(
  process.env.E2E_BACKEND_JAR ?? path.join(__dirname, "../backend/target/sprachweg-backend-0.1.0-SNAPSHOT.jar"),
);
// The backend writes its H2 database and uploads relative to its working directory: keep them out of the repo.
const backendWorkDir = process.env.E2E_BACKEND_WORKDIR ?? path.join(__dirname, "test-results", "backend");
mkdirSync(backendWorkDir, { recursive: true });
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/artifacts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 1,
  reporter: isCI
    ? [["list"], ["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: webUrl,
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: [
    {
      name: "backend",
      command: [
        "java -jar",
        JSON.stringify(backendJar),
        `--server.port=${apiPort}`,
        `--app.cors.allowed-origins=${webUrl}`,
        `--app.frontend-url=${webUrl}`,
        `--app.public-base-url=${apiUrl}`,
      ].join(" "),
      cwd: backendWorkDir,
      url: `${apiUrl}/actuator/health/readiness`,
      env: {
        SPRING_PROFILES_ACTIVE: "dev",
        MAIL_ENABLED: "false",
        RATE_LIMIT_ENABLED: "false",
      },
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      name: "frontend",
      command: `npx next start -p ${webPort}`,
      cwd: __dirname,
      url: webUrl,
      env: {
        API_URL_INTERNAL: apiUrl,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
