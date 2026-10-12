import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnRedirect } from "@/components/learn/learn-redirect";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("learn") };
}

export default function LearnCoursePage() {
  return <LearnRedirect />;
}
