"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { passwordStrength } from "@/lib/validation";

export function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const t = useTranslations("auth");
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const colors = ["bg-muted", "bg-destructive", "bg-warning", "bg-info", "bg-success"];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations("auth");
  const score = passwordStrength(password);
  return (
    <div className="grid gap-1.5" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 rounded-full transition-colors duration-300", i <= score ? colors[score] : "bg-muted")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {score > 0
          ? t.rich("strength", {
              label: t(`strengthLabels.${score as 1 | 2 | 3 | 4}`),
              b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
            })
          : t("strengthHint")}
      </p>
    </div>
  );
}
