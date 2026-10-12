"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Library } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useInstructorCourses } from "@/hooks/queries/instructor";
import { LevelBadge, VisibilityBadge } from "@/components/course/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** Instructor overview: one row per course with a "View reports" link. */
export function CourseReportsCard({ className }: { className?: string }) {
  const t = useTranslations("reports");
  const courses = useInstructorCourses();
  const list = [...(courses.data ?? [])].sort(
    (a, b) =>
      b.studentCount - a.studentCount || b.updatedAt.localeCompare(a.updatedAt),
  );
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("dashboard.title")}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/instructor/courses">
            {t("dashboard.allCourses")} <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {courses.isPending ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState compact icon={Library} title={t("dashboard.empty")} />
        ) : (
          <ul className="-mx-2 grid gap-0.5">
            {list.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/instructor/courses/${c.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <LevelBadge level={c.level} />
                    <VisibilityBadge
                      visibility={c.visibility}
                      publishAt={c.publishAt}
                      compact
                    />
                    <span>
                      {t("dashboard.learners", { count: c.studentCount })}
                    </span>
                    {c.pendingCount > 0 && (
                      <span>
                        · {t("dashboard.pending", { count: c.pendingCount })}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="xs" asChild>
                  <Link
                    href={`/instructor/courses/${c.id}?tab=reports`}
                    aria-label={t("dashboard.viewFor", { title: c.title })}
                  >
                    <BarChart3 />{" "}
                    <span className="hidden sm:inline">
                      {t("dashboard.view")}
                    </span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
