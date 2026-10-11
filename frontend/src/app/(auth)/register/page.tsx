import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("register") };
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[34rem] w-full" />}>
      <RegisterForm />
    </Suspense>
  );
}
