"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, Pin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LearnerAnnouncementDto } from "@/lib/api/announcements";
import { useLearnerAnnouncements, useMarkAnnouncementRead } from "@/hooks/queries/announcements";
import { useFormat } from "@/hooks/use-format";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { RichContent } from "@/components/course/rich-content";
import { useLearnContext } from "@/components/learn/learn-shell";
import { MessageInstructorButton } from "@/components/messages/message-button";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

/** Marks an unread announcement as read once it has been visible for a moment. */
function useMarkOnView(a: LearnerAnnouncementDto, enabled: boolean, onRead: (id: string) => void) {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || a.read || !el) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry.isIntersecting && document.visibilityState === "visible") {
          timer = window.setTimeout(() => {
            onRead(a.id);
            observer.disconnect();
          }, 1200);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [a.id, a.read, enabled, onRead]);
  return ref;
}

function AnnouncementCard({ a, track, onRead }: { a: LearnerAnnouncementDto; track: boolean; onRead: (id: string) => void }) {
  const t = useTranslations("announcements.learner");
  const fmt = useFormat();
  const ref = useMarkOnView(a, track, onRead);
  const unread = track && !a.read;
  const titleId = `announcement-${a.id}`;
  return (
    <article
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-xs sm:p-6",
        a.pinned && "border-brand/30",
        unread && "ring-1 ring-brand/40",
      )}
    >
      {a.pinned && <div className="absolute inset-x-0 top-0 h-1 bg-brand" aria-hidden />}
      <header className="flex items-start gap-3">
        <UserAvatar name={a.author.fullName} src={a.author.avatarUrl} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{a.author.fullName}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={a.sentAt} title={fmt.dateTime(a.sentAt)}>
              {fmt.dateTime(a.sentAt)}
            </time>
            {a.edited && <span title={fmt.dateTime(a.updatedAt)}> · {t("edited")}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {unread && <Badge variant="brand">{t("new")}</Badge>}
          {a.pinned && (
            <Badge variant="outline">
              <Pin className="fill-current" /> {t("pinned")}
            </Badge>
          )}
        </div>
      </header>
      <h2 id={titleId} className="mt-4 text-lg leading-snug font-semibold tracking-tight text-balance break-words">
        {a.title}
      </h2>
      <RichContent html={a.body} className="mt-2 max-w-none text-[15px]" />
    </article>
  );
}

/** `/learn/[courseId]/announcements`: the course's announcements for the learner (or the owner's preview). */
export function LearnerAnnouncementsFeed() {
  const t = useTranslations("announcements.learner");
  const { data } = useLearnContext();
  const { user } = useAuth();
  const course = data.course;
  const feed = useLearnerAnnouncements(course.id);
  const markRead = useMarkAnnouncementRead(course.id);
  const isOwner = !!user && course.instructor.id === user.id;
  const mutate = markRead.mutate;
  const onRead = React.useCallback((id: string) => mutate(id), [mutate]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href={`/learn/${course.id}`} className="mb-3 hidden w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:flex">
            <ArrowLeft className="size-3" /> {t("backToCourse")}
          </Link>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <Megaphone className="size-4.5" />
            </span>
            {t("feedTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("feedDescription")}</p>
        </div>
        {!isOwner && (
          <MessageInstructorButton
            instructor={course.instructor}
            course={{ id: course.id, title: course.title }}
            className="shrink-0 self-start sm:self-auto"
          />
        )}
      </div>

      <div className="mt-8">
        {feed.isPending ? (
          <div className="grid gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : feed.isError ? (
          <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
        ) : (feed.data ?? []).length === 0 ? (
          <EmptyState icon={Megaphone} title={t("emptyTitle")} description={t("emptyText")} />
        ) : (
          <div className="grid gap-4">
            {feed.data.map((a) => (
              <AnnouncementCard key={a.id} a={a} track={!isOwner} onRead={onRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
