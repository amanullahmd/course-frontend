import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ScheduleView } from "@/components/instructor/schedule-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("schedule") };
}

export default function SchedulePage() {
  return <ScheduleView />;
}
