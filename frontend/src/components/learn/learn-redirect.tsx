"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLearnContext } from "./learn-shell";

/** /learn/[courseId]: jump to the first incomplete (or first) item. */
export function LearnRedirect() {
  const t = useTranslations("learn");
  const { data } = useLearnContext();
  const router = useRouter();
  const items = data.modules.flatMap((m) => m.items);
  const target = items.find((i) => !i.completed) ?? items[0];

  React.useEffect(() => {
    if (target) router.replace(`/learn/${data.course.id}/${target.id}`);
  }, [target, data.course.id, router]);

  if (!target) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={BookDashed}
          title={t("noLessonsTitle")}
          description={t("noLessonsText")}
          action={
            <Button variant="outline" asChild>
              <Link href="/dashboard">{t("backToMyLearning")}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-6" label={t("opening")} />
    </div>
  );
}
