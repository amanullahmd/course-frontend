import type { Metadata } from "next";
import { AttemptRedirect } from "@/components/instructor/redirects";

export const metadata: Metadata = { title: "Review attempt" };

export default function AttemptPage() {
  return <AttemptRedirect />;
}
