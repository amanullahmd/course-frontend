import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CheckEmail } from "./check-email";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("checkEmail") };
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      <CheckEmail />
    </Suspense>
  );
}
