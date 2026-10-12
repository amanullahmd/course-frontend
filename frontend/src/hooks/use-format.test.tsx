import * as React from "react";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { useFormat } from "./use-format";

function formatFor(locale: "en" | "de") {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
  return renderHook(() => useFormat(), { wrapper }).result.current;
}

describe("useFormat", () => {
  it("formats numbers with the locale's separators", () => {
    expect(formatFor("en").number(1234567.5)).toBe("1,234,567.5");
    expect(formatFor("de").number(1234567.5)).toBe("1.234.567,5");
    expect(formatFor("de").number(0)).toBe("0");
  });

  it("formats dates in the active language", () => {
    expect(formatFor("en").date("2026-12-24T10:00:00Z", "d MMMM yyyy")).toBe("24 December 2026");
    expect(formatFor("de").date("2026-12-24T10:00:00Z", "d MMMM yyyy")).toBe("24 Dezember 2026");
    expect(formatFor("de").dateTime("2026-12-24T10:00:00Z")).toBe("24 Dez. 2026, 10:00");
    expect(formatFor("en").date(null)).toBe("");
  });

  it("exposes the active locale", () => {
    expect(formatFor("de").locale).toBe("de");
    expect(formatFor("en").locale).toBe("en");
  });
});
