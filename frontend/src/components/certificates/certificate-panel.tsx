"use client";

import { useCertificateSettings } from "@/hooks/queries/certificates";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CertificateSettingsForm } from "./certificate-settings-form";
import { IssuedCertificates } from "./issued-certificates";

/** Course builder tab "Certificate": settings with live preview and the issued certificates. */
export function CertificatePanel({ courseId, courseSlug }: { courseId: string; courseSlug: string }) {
  const settings = useCertificateSettings(courseId);
  if (settings.isPending) {
    return (
      <div className="grid gap-6 xl:grid-cols-[27rem_1fr]">
        <Skeleton className="h-[32rem] rounded-xl" />
        <Skeleton className="aspect-[297/210] rounded-xl" />
      </div>
    );
  }
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  return (
    <div className="grid gap-12">
      <CertificateSettingsForm key={settings.data.updatedAt ?? "defaults"} settings={settings.data} />
      <IssuedCertificates courseId={courseId} courseSlug={courseSlug} />
    </div>
  );
}
