import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { InstructorDashboard } from "@/components/instructor/instructor-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("instructor") };
}

export default function InstructorPage() {
  return <InstructorDashboard />;
}
