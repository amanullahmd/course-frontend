"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCreateCourse } from "@/hooks/queries/instructor";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { CourseForm } from "@/components/builder/course-form";

export function NewCourse() {
  const router = useRouter();
  const create = useCreateCourse();
  return (
    <PageContainer className="max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="hover:text-foreground">
          My courses
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">New course</span>
      </nav>
      <PageHeader title="Create a course" description="Start with the essentials. Your course stays a private draft until you publish it." />
      <div className="mt-8">
        <CourseForm
          submitLabel="Create course"
          onCancel={() => router.push("/instructor/courses")}
          onSubmit={async (body) => {
            const course = await create.mutateAsync(body);
            toast.success("Course created. Now add your first module.");
            router.push(`/instructor/courses/${course.id}`);
          }}
        />
      </div>
    </PageContainer>
  );
}
