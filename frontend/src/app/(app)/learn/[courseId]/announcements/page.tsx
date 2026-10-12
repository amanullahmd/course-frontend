import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnerAnnouncementsFeed } from "@/components/announcements/learner-feed";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("announcements") };
}

export default function LearnAnnouncementsPage() {
  return <LearnerAnnouncementsFeed />;
}
