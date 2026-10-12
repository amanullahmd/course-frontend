"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LearnCourseDto } from "@/lib/api/types";
import { useLearnerAnnouncements } from "@/hooks/queries/announcements";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { MessageInstructorButton } from "@/components/messages/message-button";
import { PracticeLinks } from "@/components/learn/practice-links";

/** Top of the course player outline: the announcements entry (with unread badge) and "Message instructor". */
export function CourseSidebarLinks({ data, onNavigate }: { data: LearnCourseDto; onNavigate?: () => void }) {
  const t = useTranslations("announcements.learner");
  const pathname = usePathname();
  const { user } = useAuth();
  const course = data.course;
  const feed = useLearnerAnnouncements(course.id);
  const isOwner = !!user && course.instructor.id === user.id;
  const unread = isOwner ? 0 : (feed.data ?? []).filter((a) => !a.read).length;
  const href = `/learn/${course.id}/announcements`;
  const active = pathname === href;
  return (
    <div className="mb-2 grid gap-0.5 border-b pb-2">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border",
        )}
      >
        <span className="grid size-6 place-items-center rounded-md bg-brand-soft text-brand-strong">
          <Megaphone className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{t("entry")}</span>
        {unread > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums">
            <span className="sr-only">{t("unread", { count: unread })}</span>
            <span aria-hidden>{unread}</span>
          </span>
        )}
      </Link>
      <PracticeLinks data={data} onNavigate={onNavigate} />
      {!isOwner && (
        <MessageInstructorButton
          instructor={course.instructor}
          course={{ id: course.id, title: course.title }}
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-start gap-2.5 px-2 py-1.5 text-[13px] font-normal text-muted-foreground hover:text-foreground [&_svg]:mx-1 [&_svg]:size-4"
        />
      )}
    </div>
  );
}
