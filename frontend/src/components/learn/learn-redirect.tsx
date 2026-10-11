"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookDashed } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLearnContext } from "./learn-shell";

/** /learn/[courseId]: jump to the first incomplete (or first) item. */
export function LearnRedirect() {
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
          title="No lessons published yet"
          description="Your instructor hasn't released any content yet. You'll find new lessons here as soon as they go live."
          action={
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to my learning</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="grid place-items-center py-24">
      <Spinner className="size-6" label="Opening your next lesson" />
    </div>
  );
}
