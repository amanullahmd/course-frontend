import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthHeading({
  title,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "error" | "brand";
}) {
  const toneClass = {
    default: "bg-muted text-foreground",
    success: "bg-success-soft text-success",
    error: "bg-destructive-soft text-destructive",
    brand: "bg-brand-soft text-brand-strong",
  }[tone];
  return (
    <div className="mb-8 grid gap-2">
      {Icon && (
        <span className={cn("mb-3 grid size-12 place-items-center rounded-2xl", toneClass)}>
          <Icon className="size-6" />
        </span>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function FormAlert({
  tone = "error",
  children,
  action,
}: {
  tone?: "error" | "info" | "success" | "warning";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const toneClass = {
    error: "border-destructive/25 bg-destructive-soft/60 text-destructive",
    info: "border-info/25 bg-info-soft/60 text-info",
    success: "border-success/25 bg-success-soft/60 text-success",
    warning: "border-warning/30 bg-warning-soft/60 text-warning",
  }[tone];
  return (
    <div role="alert" className={cn("grid gap-2 rounded-lg border px-3.5 py-3 text-sm", toneClass)}>
      <div>{children}</div>
      {action}
    </div>
  );
}
