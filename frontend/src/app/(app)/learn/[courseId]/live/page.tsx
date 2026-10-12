import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnerLiveView } from "@/components/live/learner-live-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("live") };
}

export default function LearnLivePage() {
  return <LearnerLiveView />;
}
