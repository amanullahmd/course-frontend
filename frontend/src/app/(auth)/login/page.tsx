import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("login") };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <LoginForm />
    </Suspense>
  );
}
