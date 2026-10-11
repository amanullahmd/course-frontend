import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckEmail } from "./check-email";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Check your e-mail" };

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      <CheckEmail />
    </Suspense>
  );
}
