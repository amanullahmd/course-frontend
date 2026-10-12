import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstructorCourseList } from "@/components/instructor/course-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("myCourses") };
}

export default function InstructorCoursesPage() {
  return <InstructorCourseList />;
}
