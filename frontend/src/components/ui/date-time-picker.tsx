"use client";

import * as React from "react";
import { CalendarClock, X } from "lucide-react";
import { isoToLocalInput, localInputToIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { inputClass } from "./input";
import { useTranslations } from "next-intl";

interface DateTimePickerProps {
  id?: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

/** Native datetime-local input, styled; emits ISO instants (UTC). */
export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  clearable = true,
  className,
  ...aria
}: DateTimePickerProps) {
  const t = useTranslations("ui");
  const local = isoToLocalInput(value);
  return (
    <div className={cn("relative", className)}>
      <CalendarClock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type="datetime-local"
        value={local}
        disabled={disabled}
        onChange={(e) => onChange(localInputToIso(e.target.value))}
        className={cn(
          inputClass,
          "pl-9 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-60",
          clearable && local && "pr-9",
        )}
        {...aria}
      />
      {clearable && local && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t("clearDate")}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
