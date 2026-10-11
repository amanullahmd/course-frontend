"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileQuestionMark } from "lucide-react";
import { useTranslations } from "next-intl";
import { instructorApi } from "@/lib/api/instructor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";

function Redirecting() {
  const t = useTranslations("pages");
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-6" label={t("redirecting")} />
    </div>
  );
}

/** /instructor/courses/[courseId]/enrollments → Students tab of the course builder. */
export function EnrollmentsRedirect() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  React.useEffect(() => {
    router.replace(`/instructor/courses/${courseId}?tab=students`);
  }, [courseId, router]);
  return <Redirecting />;
}

/** /instructor/attempts/[attemptId] → the item's Submissions tab with the grading drawer open. */
export function AttemptRedirect() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const t = useTranslations("instructor");
  const router = useRouter();
  const target = useQuery({
    queryKey: ["attempt-redirect", attemptId],
    queryFn: async () => {
      const attempt = await instructorApi.attempt(attemptId);
      const item = await instructorApi.item(attempt.itemId);
      return `/instructor/courses/${item.courseId}/items/${item.id}?tab=submissions&attempt=${attempt.id}`;
    },
    retry: false,
  });
  React.useEffect(() => {
    if (target.data) router.replace(target.data);
  }, [target.data, router]);
  if (target.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={FileQuestionMark}
          title={t("attemptNotFound")}
          description={t("attemptNotFoundText")}
          action={
            <Button asChild>
              <Link href="/instructor">{t("backToOverview")}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <Redirecting />;
}
