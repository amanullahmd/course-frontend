"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUnreadAnnouncements } from "@/hooks/queries/announcements";

/** "2 new announcements" chip for a course card on the student dashboard (nothing when all are read). */
export function UnreadAnnouncementsHint({ courseId }: { courseId: string }) {
  const t = useTranslations("announcements.learner");
  const { data } = useUnreadAnnouncements();
  const count = data?.[courseId] ?? 0;
  if (count === 0) return null;
  return (
    <Link
      href={`/learn/${courseId}/announcements`}
      className="flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-strong ring-1 ring-brand/25 ring-inset transition-colors hover:bg-brand-soft/70"
    >
      <Megaphone className="size-3.5" /> {t("hint", { count })}
    </Link>
  );
}
