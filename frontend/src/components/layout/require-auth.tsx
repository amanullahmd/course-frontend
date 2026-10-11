"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Role } from "@/lib/api/types";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { homeForRole } from "./nav-config";

export function PageSkeleton() {
  const t = useTranslations("common");
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-busy aria-label={t("loading")}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function Forbidden() {
  const { user } = useAuth();
  const t = useTranslations("access");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft text-warning">
        <ShieldAlert className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">{t("forbiddenTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("forbiddenText")}</p>
      <Button asChild>
        <Link href={homeForRole(user?.role)}>{t("goDashboard")}</Link>
      </Button>
    </div>
  );
}

/** Client-side guard: redirects anonymous users to /login?next=… and checks roles. */
export function RequireAuth({
  roles,
  children,
  fallback,
}: {
  roles?: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { status, user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      const next = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router]);

  if (status !== "authenticated" || !user) return <>{fallback ?? <PageSkeleton />}</>;
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return <>{children}</>;
}
