import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerifyEmail } from "./verify-email";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("verifyEmail") };
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-60 w-full" />}>
      <VerifyEmail />
    </Suspense>
  );
}
