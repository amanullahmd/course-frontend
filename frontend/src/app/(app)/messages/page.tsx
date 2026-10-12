import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NoConversationSelected } from "@/components/messages/messages-shell";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("messages") };
}

export default function MessagesPage() {
  return <NoConversationSelected />;
}
