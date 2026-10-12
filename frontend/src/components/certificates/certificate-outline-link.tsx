"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCertificateStatus } from "@/hooks/queries/certificates";

/** "Certificate" entry at the end of the course outline (hidden when the course has no certificate). */
export function CertificateOutlineLink({
  courseId,
  progressPercent,
  onNavigate,
}: {
  courseId: string;
  progressPercent: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations("certificates");
  const pathname = usePathname();
  const status = useCertificateStatus(courseId, progressPercent);
  const s = status.data?.status;
  if (!s || s === "NOT_ENABLED") return null;
  const href = `/learn/${courseId}/certificate`;
  const active = pathname === href;
  const issued = s === "ISSUED";
  const met = status.data?.criteria.filter((c) => c.met).length ?? 0;
  const total = status.data?.criteria.length ?? 0;
  return (
    <div className="mt-1 border-t px-0 pt-2">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border",
        )}
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md",
            issued ? "bg-[#151C38] text-[#F2B544]" : "bg-brand-soft text-brand-strong",
          )}
        >
          <Award className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground">{t("outlineLabel")}</span>
          <span className="block text-[11px]">
            {issued ? t("outlineEarned") : s === "REVOKED" ? t("outlineRevoked") : t("outlineProgress", { met, total })}
          </span>
        </span>
        {issued && (
          <span className="grid size-4 shrink-0 place-items-center rounded-full border border-success bg-success text-white">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        )}
      </Link>
    </div>
  );
}
