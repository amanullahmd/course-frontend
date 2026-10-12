"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";

export function ReportsRedirect() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const t = useTranslations("pages");
  React.useEffect(() => {
    router.replace(`/instructor/courses/${courseId}?tab=reports`);
  }, [courseId, router]);
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-6" label={t("redirecting")} />
    </div>
  );
}
