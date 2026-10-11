"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import { homeForRole, isActive, navForRole } from "./nav-config";

function DesktopNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;
  const inSidebarArea = pathname.startsWith("/instructor");
  return (
    <nav aria-label="Main" className={cn("hidden items-center gap-1 md:flex", inSidebarArea && "lg:hidden")}>
      {navForRole(user.role).map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav aria-label="Mobile" className="grid gap-1 p-3">
      {navForRole(user.role).map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            <Icon className="size-4" /> {item.label}
          </Link>
        );
      })}
      <div className="my-2 h-px bg-border" />
      {[
        { href: "/notifications", label: "Notifications" },
        { href: "/settings", label: "Settings" },
      ].map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppHeader() {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <Logo href={homeForRole(user?.role)} className="mr-2" />
        <React.Suspense fallback={null}>
          <DesktopNav />
        </React.Suspense>
        <div className="ml-auto flex items-center gap-1.5">
          {user && <NotificationsBell />}
          <UserMenu />
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0">
          <div className="border-b p-4">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main navigation</SheetDescription>
            <Logo href={homeForRole(user?.role)} />
          </div>
          <React.Suspense fallback={null}>
            <MobileNavList onNavigate={() => setOpen(false)} />
          </React.Suspense>
        </SheetContent>
      </Sheet>
    </header>
  );
}
