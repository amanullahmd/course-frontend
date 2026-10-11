import type { Metadata } from "next";
import { NewCourse } from "@/components/instructor/new-course";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return <NewCourse />;
}
