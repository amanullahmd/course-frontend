"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, LayoutGrid, Layers, Library, List, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { InstructorCourseDto, Visibility } from "@/lib/api/types";
import { VISIBILITY_META } from "@/lib/constants";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useInstructorCourses } from "@/hooks/queries/instructor";
import { usePersistentState } from "@/hooks/use-local-storage";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { LevelBadge, VisibilityBadge } from "@/components/course/badges";
import { CourseCover } from "@/components/course/course-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CourseActiveSwitch } from "@/components/builder/course-active-switch";

function CourseTile({ course }: { course: InstructorCourseDto }) {
  const t = useTranslations();
  const fmt = useFormat();
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/instructor/courses/${course.id}`} className="flex flex-1 flex-col outline-none">
        <div className="relative aspect-[2.2/1] overflow-hidden">
          <CourseCover title={course.title} src={course.coverImageUrl} level={course.level} size="sm" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <LevelBadge level={course.level} className="bg-white/90 dark:bg-black/60" />
          </div>
          <div className="absolute top-3 right-3">
            <VisibilityBadge visibility={course.visibility} publishAt={course.publishAt} compact className="bg-white/90 dark:bg-black/70" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 pb-3">
          <div>
            <h3 className="line-clamp-1 font-semibold">{course.title}</h3>
            <p className="line-clamp-1 text-sm text-muted-foreground">{course.subtitle || t("instructor.noSubtitle")}</p>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="size-3.5" /> {t("course.modulesCount", { count: course.moduleCount })} · {t("course.itemsCount", { count: course.itemCount })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" /> {course.studentCount}
            </span>
            {course.pendingCount > 0 && <Badge variant="info">{t("instructor.pendingCount", { count: course.pendingCount })}</Badge>}
          </div>
        </div>
      </Link>
      <div className="mx-4 flex items-center justify-between gap-2 border-t py-2.5">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" /> {t("instructor.updated", { when: fmt.relative(course.updatedAt) })}
        </p>
        <CourseActiveSwitch course={course} />
      </div>
    </div>
  );
}

const FILTERS: ("ALL" | Visibility)[] = ["ALL", "DRAFT", "SCHEDULED", "LIVE", "EXPIRED"];

export function InstructorCourseList() {
  const t = useTranslations();
  const fmt = useFormat();
  const courses = useInstructorCourses();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"ALL" | Visibility>("ALL");
  const [view, setView] = usePersistentState<"grid" | "table">("sw.courses.view", "grid");

  const q = query.trim().toLowerCase();
  const list = (courses.data ?? [])
    .filter((c) => filter === "ALL" || c.visibility === filter)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || (c.subtitle ?? "").toLowerCase().includes(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <PageContainer wide>
      <PageHeader
        title={t("instructor.myCourses")}
        description={t("instructor.myCoursesText")}
        actions={
          <Button asChild>
            <Link href="/instructor/courses/new">
              <Plus /> {t("instructor.newCourse")}
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("instructor.filterStatus")}>
          {FILTERS.map((f) => {
            const count = f === "ALL" ? courses.data?.length : courses.data?.filter((c) => c.visibility === f).length;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                  filter === f && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                )}
              >
                {f !== "ALL" && <span className={cn("size-1.5 rounded-full", VISIBILITY_META[f].dot)} />}
                {f === "ALL" ? t("instructor.all") : t(`visibility.${f}.label`)}
                {count != null && <span className="tabular-nums opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder={t("instructor.searchCourses")} className="flex-1 md:w-64" />
          <Segmented
            aria-label={t("instructor.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <span className="sr-only">{t("instructor.grid")}</span>, icon: <LayoutGrid /> },
              { value: "table", label: <span className="sr-only">{t("instructor.table")}</span>, icon: <List /> },
            ]}
          />
        </div>
      </div>

      <div className="mt-6">
        {courses.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : courses.isError ? (
          <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
        ) : (courses.data ?? []).length === 0 ? (
          <EmptyState
            icon={Library}
            title={t("instructor.firstCourse")}
            description={t("instructor.firstCourseText")}
            action={
              <Button asChild>
                <Link href="/instructor/courses/new">
                  <Plus /> {t("instructor.newCourse")}
                </Link>
              </Button>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState icon={Library} title={t("instructor.noMatch")} description={t("instructor.noMatchText")} compact />
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <CourseTile key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("instructor.course")}</TableHead>
                  <TableHead>{t("instructor.status")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("instructor.content")}</TableHead>
                  <TableHead className="text-right">{t("instructor.learners")}</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">{t("instructor.updatedCol")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/instructor/courses/${c.id}`} className="flex items-center gap-3">
                        <span className="size-10 shrink-0 overflow-hidden rounded-lg">
                          <CourseCover title={c.title} src={c.coverImageUrl} level={c.level} size="sm" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{c.title}</span>
                          <LevelBadge level={c.level} className="mt-0.5" />
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-3">
                        <CourseActiveSwitch course={c} showLabel={false} />
                        <VisibilityBadge visibility={c.visibility} publishAt={c.publishAt} compact />
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {t("course.modulesCount", { count: c.moduleCount })} · {t("course.itemsCount", { count: c.itemCount })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.studentCount}
                      {c.pendingCount > 0 && <Badge variant="info" className="ml-2">{t("instructor.pendingCount", { count: c.pendingCount })}</Badge>}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{fmt.relative(c.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
