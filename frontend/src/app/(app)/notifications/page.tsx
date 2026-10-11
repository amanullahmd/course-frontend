import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsView } from "@/components/account/notifications-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("notifications") };
}

export default function NotificationsPage() {
  return <NotificationsView />;
}
