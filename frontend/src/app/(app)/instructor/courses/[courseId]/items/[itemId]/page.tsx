import type { Metadata } from "next";
import { ItemEditor } from "@/components/builder/item-editor";

export const metadata: Metadata = { title: "Edit item" };

export default function ItemEditorPage() {
  return <ItemEditor />;
}
