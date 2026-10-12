import { expect, test } from "@playwright/test";
import { DEMO, de, en, login, publicCourse, setLanguage } from "./fixtures";

test.describe("public pages", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await setLanguage(page, baseURL, "en");
  });

  test("landing page renders", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Sprachweg/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(en.marketing.heroTitle1);
    await expect(page.getByRole("link", { name: en.nav.login }).first()).toBeVisible();
  });

  test("catalog lists the seeded A1 course and opens its page", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { level: 1, name: en.catalog.title })).toBeVisible();
    const card = page.getByRole("link", { name: new RegExp(DEMO.course.title) }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/courses/${DEMO.course.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: DEMO.course.title })).toBeVisible();
  });

  test("an unknown route shows the 404 page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: en.pages.notFoundTitle })).toBeVisible();
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });

  test("an unknown course slug shows a 404", async ({ page }) => {
    const response = await page.goto("/courses/this-course-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("language", () => {
  test("switching from English to German changes the UI text", async ({ page, baseURL }) => {
    await setLanguage(page, baseURL, "en");
    await page.goto("/");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toContainText(en.marketing.heroTitle1);

    await page.getByRole("button", { name: en.locale.switch }).first().click();
    await page.getByRole("menuitemradio", { name: /Deutsch/ }).click();

    await expect(hero).toContainText(de.marketing.heroTitle1);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("de");

    // The choice survives a reload (cookie-based, no i18n routing).
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(de.marketing.heroTitle1);
  });
});

test.describe("signed in", () => {
  test("the instructor logs in and lands on the instructor dashboard", async ({ page, baseURL }) => {
    await setLanguage(page, baseURL, "en");
    await login(page, DEMO.instructor.email);
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      en.instructor.hello.replace("{name}", DEMO.instructor.firstName),
    );
  });

  test("the student opens a lesson of an approved course", async ({ page, baseURL, request }) => {
    await setLanguage(page, baseURL, "en");
    const course = await publicCourse(request, DEMO.course.slug);

    await login(page, DEMO.student.email);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(DEMO.course.title).first()).toBeVisible();

    await page.goto(`/learn/${course.id}`);
    // /learn/{courseId} continues with the first (or next) lesson.
    await expect(page).toHaveURL(new RegExp(`/learn/${course.id}/[0-9a-f-]{36}$`));
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    // Outline sidebar: course title, progress and the seeded lessons (course content itself is not translated).
    await expect(page.getByText(DEMO.course.title).first()).toBeVisible();
    await expect(page.getByText(en.learn.progress, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Begrüßungen im Alltag/ }).first()).toBeVisible();
  });

  test("a protected page redirects anonymous visitors to the login", async ({ page, baseURL }) => {
    await setLanguage(page, baseURL, "en");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: en.auth.login.title })).toBeVisible();
  });
});
