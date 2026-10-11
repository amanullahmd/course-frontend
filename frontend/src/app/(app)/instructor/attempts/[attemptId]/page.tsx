import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AttemptRedirect } from "@/components/instructor/redirects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("attempt") };
}

export default function AttemptPage() {
  return <AttemptRedirect />;
}
