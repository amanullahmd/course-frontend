import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnItemView } from "@/components/learn/learn-item-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("lesson") };
}

export default function LearnItemPage() {
  return <LearnItemView />;
}
