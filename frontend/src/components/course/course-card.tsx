import Link from "next/link";
import { Layers, Users } from "lucide-react";
import type { CourseSummaryDto } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/avatar";
import { CourseCover } from "./course-cover";
import { LevelBadge } from "./badges";

export function CourseCard({ course, className }: { course: CourseSummaryDto; className?: string }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all duration-200 outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <div className="size-full transition-transform duration-500 group-hover:scale-[1.03]">
          <CourseCover title={course.title} src={course.coverImageUrl} level={course.level} />
        </div>
        <div className="absolute top-3 left-3 flex gap-1.5">
          <LevelBadge level={course.level} className="bg-white/90 backdrop-blur dark:bg-black/60" />
          {course.enrollmentMode === "OPEN" && (
            <span className="rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-800 backdrop-blur dark:bg-black/60 dark:text-white">
              Open
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid gap-1">
          <h3 className="line-clamp-2 font-semibold tracking-tight">{course.title}</h3>
          {course.subtitle && <p className="line-clamp-2 text-sm text-muted-foreground">{course.subtitle}</p>}
        </div>
        {course.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {course.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={course.instructor.fullName} src={course.instructor.avatarUrl} className="size-6" />
            <span className="truncate">{course.instructor.fullName}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3 tabular-nums">
            <span className="flex items-center gap-1" title="Modules">
              <Layers className="size-3.5" /> {course.moduleCount}
            </span>
            <span className="flex items-center gap-1" title="Learners">
              <Users className="size-3.5" /> {course.studentCount}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="skeleton-shimmer aspect-[16/9]" />
      <div className="grid gap-3 p-4">
        <div className="skeleton-shimmer h-5 w-3/4 rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer mt-3 h-6 w-1/2 rounded" />
      </div>
    </div>
  );
}
