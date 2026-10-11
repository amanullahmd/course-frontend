import type { Metadata } from "next";
import { InstructorDashboard } from "@/components/instructor/instructor-dashboard";

export const metadata: Metadata = { title: "Instructor overview" };

export default function InstructorPage() {
  return <InstructorDashboard />;
}
