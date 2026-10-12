import * as React from "react";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import { ApiError } from "@/lib/api/client";
import { useErrorMessage } from "./use-error-message";

function setup(locale: "en" | "de") {
  const messages = locale === "de" ? de : en;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useErrorMessage(), { wrapper }).result.current;
}

const reference = (messages: typeof en, id: string) => messages.errors.reference.replace("{id}", id);

describe("useErrorMessage", () => {
  it("maps known backend codes to localized texts", () => {
    const toMessage = setup("en");
    expect(toMessage(new ApiError(401, { code: "INVALID_CREDENTIALS", detail: "Email or password is incorrect." }))).toBe(
      en.errors.codes.INVALID_CREDENTIALS,
    );
    expect(toMessage(new ApiError(409, { code: "CAPACITY_REACHED" }))).toBe(en.errors.codes.CAPACITY_REACHED);
    expect(toMessage(new ApiError(400, { code: "VALIDATION_FAILED", errors: { email: "bad" } }))).toBe(
      en.errors.codes.VALIDATION_FAILED,
    );
  });

  it("uses the German catalogue for the de locale", () => {
    const toMessage = setup("de");
    const message = toMessage(new ApiError(403, { code: "NOT_ENROLLED" }));
    expect(message).toBe(de.errors.codes.NOT_ENROLLED);
    expect(message).not.toBe(en.errors.codes.NOT_ENROLLED);
  });

  it("maps every <ENTITY>_NOT_FOUND code to the generic not-found text", () => {
    const toMessage = setup("en");
    for (const code of ["COURSE_NOT_FOUND", "ITEM_NOT_FOUND", "SOMETHING_NEW_NOT_FOUND"]) {
      const expected = code in en.errors.codes ? en.errors.codes[code as keyof typeof en.errors.codes] : en.errors.codes.NOT_FOUND;
      expect(toMessage(new ApiError(404, { code, detail: "Course not found." }))).toBe(expected);
    }
    expect(toMessage(new ApiError(404, { code: "SOMETHING_NEW_NOT_FOUND" }))).toBe(en.errors.codes.NOT_FOUND);
  });

  it("never shows raw 5xx output and appends the trace reference", () => {
    const toMessage = setup("en");
    const unknown5xx = new ApiError(502, { detail: "<html>Bad Gateway</html>" });
    expect(toMessage(unknown5xx)).toBe(en.errors.server);

    const withTrace = new ApiError(500, { code: "INTERNAL_ERROR", detail: "NullPointerException", traceId: "abc123" });
    const message = toMessage(withTrace);
    expect(message).toContain(reference(en, "abc123"));
    expect(message).not.toContain("NullPointerException");

    const serverWithoutCode = new ApiError(503, { traceId: "t-1" });
    expect(toMessage(serverWithoutCode)).toBe(`${en.errors.server} ${reference(en, "t-1")}`);
  });

  it("shows a calm network message when the API is unreachable", () => {
    expect(setup("en")(new ApiError(0, { code: "NETWORK_ERROR" }))).toBe(en.errors.network);
    expect(setup("de")(new ApiError(0, { code: "NETWORK_ERROR" }))).toBe(de.errors.network);
  });

  it("prefers the backend's localized detail for unknown 4xx codes", () => {
    const toMessage = setup("de");
    expect(toMessage(new ApiError(400, { code: "BRAND_NEW_CODE", detail: "Ganz neuer Fehler." }))).toBe("Ganz neuer Fehler.");
  });

  it("falls back to the HTTP status text, then to the generic text", () => {
    const toMessage = setup("en");
    expect(toMessage(new ApiError(403, {}))).toBe(en.errors.status["403"]);
    expect(toMessage(new ApiError(429, {}))).toBe(en.errors.status["429"]);
    expect(toMessage(new ApiError(418, {}))).toBe(en.errors.unknown);
  });

  it("handles errors that are not ApiErrors", () => {
    const toMessage = setup("en");
    expect(toMessage(new Error("boom"))).toBe(en.errors.unknown);
    expect(toMessage("string error")).toBe(en.errors.unknown);
    expect(toMessage(undefined)).toBe(en.errors.unknown);
  });
});
