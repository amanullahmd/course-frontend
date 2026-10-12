import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ItemEditor } from "@/components/builder/item-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("editItem") };
}

export default function ItemEditorPage() {
  return <ItemEditor />;
}
