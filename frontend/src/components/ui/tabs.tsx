"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: "pill" | "underline" }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fade, setFade] = React.useState({ left: false, right: false });
  React.useEffect(() => {
    const list = ref.current;
    if (!list) return;
    // Fade the edges that hide more tabs, so a horizontally scrollable tab bar reads as scrollable.
    const update = () => {
      const max = list.scrollWidth - list.clientWidth;
      const next = { left: max > 1 && list.scrollLeft > 1, right: max > 1 && list.scrollLeft < max - 1 };
      setFade((f) => (f.left === next.left && f.right === next.right ? f : next));
    };
    // Keep the active tab visible when the list scrolls horizontally (narrow screens, long German labels).
    const reveal = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (active && list.scrollWidth > list.clientWidth) {
        const left = active.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft || left + active.offsetWidth > list.scrollLeft + list.clientWidth) {
          list.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
        }
      }
      update();
    };
    reveal();
    const observer = new MutationObserver(reveal);
    observer.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    const resize = new ResizeObserver(update);
    resize.observe(list);
    list.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      resize.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);
  const mask =
    fade.left && fade.right
      ? "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]"
      : fade.left
        ? "[mask-image:linear-gradient(to_right,transparent,black_28px)]"
        : fade.right
          ? "[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
          : undefined;
  return (
    <TabsPrimitive.List
      ref={ref}
      data-variant={variant}
      className={cn(
        "group/tabs inline-flex max-w-full items-center overflow-x-auto [scrollbar-width:none]",
        variant === "pill" ? "h-9 gap-1 rounded-lg bg-muted p-1" : "h-11 w-full gap-1 border-b",
        mask,
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-full items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        "group-data-[variant=pill]/tabs:data-[state=active]:bg-card group-data-[variant=pill]/tabs:data-[state=active]:text-foreground group-data-[variant=pill]/tabs:data-[state=active]:shadow-sm",
        "group-data-[variant=underline]/tabs:relative group-data-[variant=underline]/tabs:rounded-none group-data-[variant=underline]/tabs:px-3 group-data-[variant=underline]/tabs:data-[state=active]:text-foreground group-data-[variant=underline]/tabs:after:absolute group-data-[variant=underline]/tabs:after:inset-x-2 group-data-[variant=underline]/tabs:after:-bottom-px group-data-[variant=underline]/tabs:after:h-0.5 group-data-[variant=underline]/tabs:after:rounded-full group-data-[variant=underline]/tabs:data-[state=active]:after:bg-brand",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none data-[state=active]:animate-fade-in", className)} {...props} />;
}
