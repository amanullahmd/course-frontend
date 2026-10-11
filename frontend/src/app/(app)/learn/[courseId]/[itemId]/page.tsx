import type { Metadata } from "next";
import { LearnItemView } from "@/components/learn/learn-item-view";

export const metadata: Metadata = { title: "Lesson" };

export default function LearnItemPage() {
  return <LearnItemView />;
}
