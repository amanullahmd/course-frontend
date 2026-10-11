import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, SearchX, ServerCrash } from "lucide-react";
import { fetchCatalog } from "@/lib/api/server";
import type { CefrLevel } from "@/lib/api/types";
import { CEFR_LEVELS } from "@/lib/constants";
import { cn, pluralize } from "@/lib/utils";
import { CatalogFilters } from "@/components/course/catalog-filters";
import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Course catalog",
  description: "Browse German courses from A1 to C2 and apply to join.",
};

const PAGE_SIZE = 12;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  if (page > 0) sp.set("page", String(page + 1));
  else sp.delete("page");
  const qs = sp.toString();
  return qs ? `/courses?${qs}` : "/courses";
}

async function CatalogResults({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() || undefined;
  const levelRaw = first(sp.level);
  const level = CEFR_LEVELS.includes(levelRaw as CefrLevel) ? (levelRaw as CefrLevel) : undefined;
  const page = Math.max(0, (Number.parseInt(first(sp.page) ?? "1", 10) || 1) - 1);

  const result = await fetchCatalog({ q, level, page, size: PAGE_SIZE });

  if (!result.ok) {
    return (
      <EmptyState
        icon={ServerCrash}
        title="The catalog is temporarily unavailable"
        description="We couldn't reach the course service. Please refresh the page in a moment."
        action={
          <Button variant="outline" asChild>
            <Link href="/courses">Retry</Link>
          </Button>
        }
      />
    );
  }

  const { content, totalElements, totalPages } = result.data;
  if (content.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No courses match your search"
        description={q || level ? "Try a different search term or another level." : "No courses have been published yet."}
        action={
          (q || level) && (
            <Button variant="outline" asChild>
              <Link href="/courses">Clear filters</Link>
            </Button>
          )
        }
      />
    );
  }

  const keep = { q, level };
  return (
    <div className="grid gap-8">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {pluralize(totalElements, "course")} {q && <>for “{q}”</>} {level && <>at level {level}</>}
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
          <Link
            aria-disabled={page === 0}
            href={pageHref(keep, Math.max(0, page - 1))}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page === 0 && "pointer-events-none opacity-50")}
          >
            <ChevronLeft /> Previous
          </Link>
          <span className="px-3 text-sm text-muted-foreground tabular-nums">
            Page {page + 1} of {totalPages}
          </span>
          <Link
            aria-disabled={page >= totalPages - 1}
            href={pageHref(keep, Math.min(totalPages - 1, page + 1))}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page >= totalPages - 1 && "pointer-events-none opacity-50",
            )}
          >
            Next <ChevronRight />
          </Link>
        </nav>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-8">
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function CatalogPage({ searchParams }: PageProps<"/courses">) {
  return (
    <div className="relative">
      <div className="bg-grid absolute inset-x-0 top-0 -z-10 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">Kurskatalog</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Find your next German course</h1>
          <p className="mt-3 text-muted-foreground">
            From your very first „Hallo“ to C2 nuance. Every course is taught by a real instructor who reviews each application.
          </p>
        </div>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-24 max-w-xl" />}>
            <CatalogFilters />
          </Suspense>
        </div>
        <div className="mt-10">
          <Suspense fallback={<ResultsSkeleton />}>
            <CatalogResults searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
