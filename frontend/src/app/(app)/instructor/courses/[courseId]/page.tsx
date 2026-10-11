import type { Metadata } from "next";
import { CourseBuilder } from "@/components/builder/course-builder";

export const metadata: Metadata = { title: "Course builder" };

export default function CourseBuilderPage() {
  return <CourseBuilder />;
}
