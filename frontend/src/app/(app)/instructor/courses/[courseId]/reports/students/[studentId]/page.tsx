import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnerReport } from "@/components/reports/learner-report";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("learnerReport") };
}

export default function LearnerReportPage() {
  return <LearnerReport />;
}
