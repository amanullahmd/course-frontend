import type { Metadata } from "next";
import { LearnRedirect } from "@/components/learn/learn-redirect";

export const metadata: Metadata = { title: "Learn" };

export default function LearnCoursePage() {
  return <LearnRedirect />;
}
