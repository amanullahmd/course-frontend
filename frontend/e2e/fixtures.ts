import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

type Messages = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const load = (locale: "en" | "de"): Messages =>
  JSON.parse(readFileSync(path.join(__dirname, "..", "messages", `${locale}.json`), "utf8"));

/** UI texts, so the specs follow copy changes in messages/*.json. */
export const en = load("en");
export const de = load("de");

/** Seeded demo data of the backend's dev profile (see backend/README.md). */
export const DEMO = {
  password: "Password123!",
  instructor: { email: "lehrer@sprachweg.de", firstName: "Anna" },
  student: { email: "student@sprachweg.de", firstName: "Luca" },
  course: { slug: "deutsch-a1-erste-schritte", title: "Deutsch A1: Erste Schritte" },
} as const;

export const API_URL = `http://localhost:${process.env.E2E_API_PORT ?? 8080}`;

/** Pins the UI language (the student's account prefers German, which would otherwise be adopted at login). */
export async function setLanguage(page: Page, baseURL: string | undefined, locale: "en" | "de") {
  const { hostname } = new URL(baseURL ?? "http://localhost:3000");
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: hostname, path: "/" }]);
}

export async function login(page: Page, email: string, password = DEMO.password) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: en.auth.login.title })).toBeVisible();
  await page.getByLabel(en.auth.email, { exact: true }).fill(email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: en.auth.login.submit, exact: true }).click();
}

export async function publicCourse(request: APIRequestContext, slug: string): Promise<{ id: string; title: string }> {
  const res = await request.get(`${API_URL}/api/public/courses/${slug}`);
  expect(res.ok(), `GET /api/public/courses/${slug}`).toBeTruthy();
  return res.json();
}
