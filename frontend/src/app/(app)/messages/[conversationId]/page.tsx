import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConversationView } from "@/components/messages/conversation-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("messages") };
}

export default function ConversationPage() {
  return <ConversationView />;
}
