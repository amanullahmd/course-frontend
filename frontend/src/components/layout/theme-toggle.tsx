"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  return (
    <Segmented
      aria-label={t("label")}
      value={(theme as "light" | "dark" | "system" | undefined) ?? "system"}
      onChange={setTheme}
      className="h-8 w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"
      options={[
        { value: "light", label: <span className="sr-only">{t("light")}</span>, icon: <Sun /> },
        { value: "dark", label: <span className="sr-only">{t("dark")}</span>, icon: <Moon /> },
        { value: "system", label: <span className="sr-only">{t("system")}</span>, icon: <Monitor /> },
      ]}
    />
  );
}

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  return (
    <Tooltip content={t("toggle")}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("toggle")}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </Button>
    </Tooltip>
  );
}
