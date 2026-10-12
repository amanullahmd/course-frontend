"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";

/** Sends /instructor/courses/[courseId]/<tab> to the matching tab of the course builder, keeping the query. */
export function TabRedirect({ tab }: { tab: string }) {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("pages");
  React.useEffect(() => {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", tab);
    router.replace(`/instructor/courses/${courseId}?${sp.toString()}`);
  }, [courseId, params, router, tab]);
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-6" label={t("redirecting")} />
    </div>
  );
}
