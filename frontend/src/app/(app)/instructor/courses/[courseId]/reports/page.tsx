import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportsRedirect } from "@/components/reports/reports-redirect";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("reports") };
}

/** /instructor/courses/[courseId]/reports → Reports tab of the course builder. */
export default function ReportsPage() {
  return <ReportsRedirect />;
}
