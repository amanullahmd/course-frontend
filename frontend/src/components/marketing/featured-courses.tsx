import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen } from "lucide-react";
import { fetchCatalog } from "@/lib/api/server";
import { CourseCard, CourseCardSkeleton } from "@/components/course/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export async function FeaturedCourses() {
  const t = await getTranslations("marketing");
  const result = await fetchCatalog({ size: 6 });
  if (!result.ok || result.data.content.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={result.ok ? t("featuredEmptyTitle") : t("featuredErrorTitle")}
        description={result.ok ? t("featuredEmptyText") : t("featuredErrorText")}
        action={
          <Button variant="outline" asChild>
            <Link href="/courses">{t("openCatalog")}</Link>
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
  const t = useTranslations("marketing");
  return (
    <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-strong uppercase">{t("featuredEyebrow")}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t("featuredTitle")}</h2>
      </div>
      <Button variant="ghost" asChild>
        <Link href="/courses">
          {t("viewAll")} <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
