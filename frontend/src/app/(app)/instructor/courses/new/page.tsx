import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewCourse } from "@/components/instructor/new-course";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("newCourse") };
}

export default function NewCoursePage() {
  return <NewCourse />;
}
