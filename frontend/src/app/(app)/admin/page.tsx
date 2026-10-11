import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminView } from "@/components/admin/admin-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("admin") };
}

export default function AdminPage() {
  return <AdminView />;
}
