import type { Metadata } from "next";
import { StudentDashboard } from "@/components/student/student-dashboard";

export const metadata: Metadata = { title: "My learning" };

export default function DashboardPage() {
  return <StudentDashboard />;
}
