"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useCreateCourse } from "@/hooks/queries/instructor";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CourseForm } from "@/components/builder/course-form";

export function NewCourse() {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreateCourse();
  return (
    <PageContainer className="max-w-3xl">
      <nav aria-label={t("builder.breadcrumb")} className="mb-3 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="shrink-0 hover:text-foreground">
          {t("builder.myCourses")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-foreground">{t("courseForm.newCourse")}</span>
      </nav>
      <PageHeader title={t("courseForm.createTitle")} description={t("courseForm.createText")} />
      <div className="mt-8">
        <CourseForm
          submitLabel={t("courseForm.create")}
          onCancel={() => router.push("/instructor/courses")}
          onSubmit={async (body) => {
            const course = await create.mutateAsync(body);
            toast.success(t("courseForm.created"));
            router.push(`/instructor/courses/${course.id}`);
          }}
        />
      </div>
    </PageContainer>
  );
}
