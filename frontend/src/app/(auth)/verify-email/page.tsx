import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "./verify-email";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Verify e-mail" };

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-60 w-full" />}>
      <VerifyEmail />
    </Suspense>
  );
}
