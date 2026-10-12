"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePublishCourse } from "@/hooks/queries/instructor";
import { useErrorMessage } from "@/hooks/use-error-message";
import type { PublishStatus, Visibility } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface ActiveCourse {
  id: string;
  title: string;
  publishStatus: PublishStatus;
  visibility: Visibility;
  unpublishAt?: string | null;
  studentCount: number;
}

/**
 * One-click on/off for a whole course. Active = published (live, or scheduled to go live);
 * deactivating moves the course back to draft after a confirmation, so it disappears from the
 * catalog and learners lose access until it is activated again. Enrollments are kept.
 */
export function CourseActiveSwitch({ course, showLabel = true, className }: { course: ActiveCourse; showLabel?: boolean; className?: string }) {
  const t = useTranslations("courseActive");
  const errorMessage = useErrorMessage();
  const publish = usePublishCourse(course.id);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const active = course.publishStatus === "PUBLISHED" && course.visibility !== "EXPIRED";
  const state = !active ? "inactive" : course.visibility === "SCHEDULED" ? "scheduled" : "active";

  const activate = () => {
    const keepUnpublish = course.unpublishAt && new Date(course.unpublishAt).getTime() > Date.now();
    publish.mutate(
      { publishStatus: "PUBLISHED", publishAt: null, unpublishAt: keepUnpublish ? course.unpublishAt : null },
      {
        onSuccess: () => toast.success(t("activatedToast", { title: course.title })),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };
  const deactivate = () =>
    publish.mutateAsync({ publishStatus: "DRAFT", publishAt: null, unpublishAt: null }).then(
      () => {
        setConfirmOpen(false);
        toast.success(t("deactivatedToast", { title: course.title }));
      },
      (e: unknown) => toast.error(errorMessage(e)),
    );

  return (
    <>
      <label
        className={cn("inline-flex cursor-pointer items-center gap-2 text-sm", publish.isPending && "opacity-70", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={active}
          disabled={publish.isPending}
          aria-label={t("ariaLabel", { title: course.title })}
          onCheckedChange={(next) => (next ? activate() : setConfirmOpen(true))}
        />
        {showLabel && (
          <span
            className={cn(
              "font-medium",
              state === "active" && "text-success",
              state === "scheduled" && "text-info",
              state === "inactive" && "text-muted-foreground",
            )}
          >
            {t(state)}
          </span>
        )}
      </label>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deactivateTitle")}
        description={t("deactivateText", { count: course.studentCount })}
        confirmLabel={t("deactivateConfirm")}
        destructive
        loading={publish.isPending}
        onConfirm={deactivate}
      />
    </>
  );
}
