import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { fetchCatalog } from "@/lib/api/server";
import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export async function FeaturedCourses() {
  const result = await fetchCatalog({ size: 6 });
  if (!result.ok || result.data.content.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={result.ok ? "New courses are on their way" : "Courses are loading slowly"}
        description={
          result.ok
            ? "Our instructors are preparing their first courses. Check back soon, or start teaching your own."
            : "We couldn't reach the course catalog right now. Please try again in a moment."
        }
        action={
          <Button variant="outline" asChild>
            <Link href="/courses">Open catalog</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {result.data.content.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  );
}

export function FeaturedCoursesSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function FeaturedHeader() {
  return (
    <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">Featured</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Courses open for applications</h2>
      </div>
      <Button variant="ghost" asChild>
        <Link href="/courses">
          View all courses <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
