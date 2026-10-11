"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { ThemeToggleButton } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { homeForRole } from "./nav-config";

function useLinks() {
  const t = useTranslations("nav");
  return [
    { href: "/courses", label: t("courses") },
    { href: "/#features", label: t("features") },
    { href: "/#how-it-works", label: t("howItWorks") },
    { href: "/register?role=INSTRUCTOR", label: t("forTeachers") },
  ];
}

function AuthActions() {
  const t = useTranslations("nav");
  const { status, user } = useAuth();
  if (status === "loading") return <Skeleton className="h-8 w-24" />;
  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" asChild className="hidden sm:inline-flex">
          <Link href={homeForRole(user.role)}>{t("openDashboard")}</Link>
        </Button>
        <UserMenu />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
        <Link href="/login">{t("login")}</Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/register">{t("getStarted")}</Link>
      </Button>
    </div>
  );
}

export function SiteHeader() {
  const t = useTranslations("nav");
  const links = useLinks();
  const { status } = useAuth();
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label={t("main")} className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <span className="hidden sm:inline-flex">
            <ThemeToggleButton />
          </span>
          <AuthActions />
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t("openMenu")} onClick={() => setOpen(true)}>
            <Menu />
          </Button>
        </div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0">
          <div className="border-b p-4">
            <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
            <SheetDescription className="sr-only">{t("siteNav")}</SheetDescription>
            <Logo />
          </div>
          <nav className="grid gap-1 p-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent">
                {l.label}
              </Link>
            ))}
            {status !== "authenticated" && (
              <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent">
                {t("login")}
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2 border-t p-4">
            <LocaleSwitcher />
            <ThemeToggleButton />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
