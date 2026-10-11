"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "grid aspect-square size-4 shrink-0 place-items-center rounded-full border border-input bg-card shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
    </RadioGroupPrimitive.Item>
  );
}

/** A large, card-like radio option. */
export function RadioCard({
  value,
  title,
  description,
  icon,
  className,
}: {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-all outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-brand data-[state=checked]:bg-brand-soft/40 data-[state=checked]:ring-1 data-[state=checked]:ring-brand",
        className,
      )}
    >
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground transition-colors group-data-[state=checked]:bg-brand group-data-[state=checked]:text-brand-foreground [&_svg]:size-5">
          {icon}
        </span>
      )}
      <span className="grid gap-1">
        <span className="text-sm font-semibold">{title}</span>
        {description && <span className="text-[13px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      <span className="absolute top-3 right-3 grid size-4 place-items-center rounded-full border border-input group-data-[state=checked]:border-brand">
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-brand" />
      </span>
    </RadioGroupPrimitive.Item>
  );
}
