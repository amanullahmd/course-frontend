"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme();
  return (
    <Segmented
      aria-label="Theme"
      value={(theme as "light" | "dark" | "system" | undefined) ?? "system"}
      onChange={setTheme}
      className="h-8 w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"
      options={[
        { value: "light", label: <span className="sr-only">Light</span>, icon: <Sun /> },
        { value: "dark", label: <span className="sr-only">Dark</span>, icon: <Moon /> },
        { value: "system", label: <span className="sr-only">System</span>, icon: <Monitor /> },
      ]}
    />
  );
}

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip content="Toggle theme">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle dark mode"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </Button>
    </Tooltip>
  );
}
