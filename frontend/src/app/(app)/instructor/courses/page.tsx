import type { Metadata } from "next";
import { InstructorCourseList } from "@/components/instructor/course-list";

export const metadata: Metadata = { title: "My courses" };

export default function InstructorCoursesPage() {
  return <InstructorCourseList />;
}
