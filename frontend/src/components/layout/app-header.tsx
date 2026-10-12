"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications-bell";
import { MessagesHeaderButton } from "@/components/messages/messages-header-button";
import { ThemeToggleButton } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { homeForRole, isActive, navForRole } from "./nav-config";

function DesktopNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;
  const inSidebarArea = pathname.startsWith("/instructor");
  return (
    <nav aria-label={t("main")} className={cn("hidden items-center gap-1 md:flex", inSidebarArea && "lg:hidden")}>
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
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavList({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav aria-label={t("mobile")} className="grid gap-1 p-3">
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
            <Icon className="size-4" /> {t(item.label)}
          </Link>
        );
      })}
      <div className="my-2 h-px bg-border" />
      <div className="px-3 py-2">
        <LocaleSwitcher />
      </div>
      {[
        { href: "/messages", label: t("messages") },
        { href: "/notifications", label: t("notifications") },
        { href: "/settings", label: t("settings") },
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
  const t = useTranslations("nav");
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("openNav")} onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <Logo href={homeForRole(user?.role)} className="mr-2" />
        <React.Suspense fallback={null}>
          <DesktopNav />
        </React.Suspense>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <span className="hidden sm:inline-flex">
            <ThemeToggleButton />
          </span>
          {user && <MessagesHeaderButton />}
          {user && <NotificationsBell />}
          <UserMenu />
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0">
          <div className="border-b p-4">
            <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
            <SheetDescription className="sr-only">{t("main")}</SheetDescription>
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
