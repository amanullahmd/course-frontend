import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentDashboard } from "@/components/student/student-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("dashboard") };
}

export default function DashboardPage() {
  return <StudentDashboard />;
}
