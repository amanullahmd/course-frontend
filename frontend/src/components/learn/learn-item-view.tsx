"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock, PartyPopper } from "lucide-react";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { isAssessmentType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMinutes } from "@/hooks/use-minutes";
import { useLearnItem, useToggleComplete } from "@/hooks/queries/student";
import { useHotkey } from "@/hooks/use-hotkey";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { RichContent } from "@/components/course/rich-content";
import { AssessmentPanel } from "@/components/quiz/assessment-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { LockedItem, lockFromError } from "./locked-item";
import { useLearnContext } from "./learn-shell";
import { ExtraAttachments, ItemViewer, viewerHandledIds } from "./viewers";
import { Lock } from "lucide-react";

function ItemSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-9 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <Skeleton className="mt-8 aspect-video w-full rounded-xl" />
      <div className="mt-8 grid gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export function LearnItemView() {
  const { courseId, itemId } = useParams<{ courseId: string; itemId: string }>();
  const router = useRouter();
  const t = useTranslations();
  const minutes = useMinutes();
  const { data: course } = useLearnContext();
  const item = useLearnItem(itemId);
  const toggle = useToggleComplete(courseId, itemId);

  const currentModule = course.modules.find((m) => m.items.some((i) => i.id === itemId));
  const all = course.modules.flatMap((m) => m.items);
  const position = all.findIndex((i) => i.id === itemId);
  const prevId = item.data?.prevItemId ?? (position > 0 ? all[position - 1].id : null);
  const nextId = item.data?.nextItemId ?? (position >= 0 && position < all.length - 1 ? all[position + 1].id : null);
  const isAssessment = item.data ? isAssessmentType(item.data.type) : false;

  useHotkey("[", () => prevId && router.push(`/learn/${courseId}/${prevId}`), { enabled: !!prevId });
  useHotkey("]", () => nextId && router.push(`/learn/${courseId}/${nextId}`), { enabled: !!nextId });
  useHotkey("m", () => item.data && !isAssessment && toggle.mutate(!item.data.completed), { enabled: !!item.data && !isAssessment });

  if (item.isPending) return <ItemSkeleton />;
  if (item.isError) {
    const status = isApiError(item.error) ? item.error.status : 0;
    if (isApiError(item.error) && item.error.code === "ITEM_LOCKED") {
      return (
        <LockedItem
          courseId={courseId}
          title={all[position]?.title}
          lock={lockFromError(item.error)}
          onRetry={item.refetch}
          checking={item.isFetching}
        />
      );
    }
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        {status === 403 || status === 404 ? (
          <EmptyState
            icon={Lock}
            title={t("learn.unavailableTitle")}
            description={t("learn.unavailableText")}
            action={
              <Button asChild variant="outline">
                <Link href={`/learn/${courseId}`}>{t("learn.goToCourse")}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={item.error} onRetry={() => item.refetch()} />
        )}
      </div>
    );
  }

  const data = item.data;
  const handled = viewerHandledIds(data);
  const extras = data.attachments.filter((a) => !handled.has(a.id));
  const isLast = !nextId;

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 lg:py-12" key={data.id}>
      <header className="animate-slide-up">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {currentModule && <span>{currentModule.title}</span>}
          {currentModule && <span aria-hidden>·</span>}
          <span className="tabular-nums">
            {t("learn.lessonOf", { current: position + 1, total: all.length })}
          </span>
        </p>
        <div className="mt-3 flex items-start gap-3">
          <ItemTypeIcon type={data.type} className="mt-1 size-9" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{data.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{t(`itemTypes.${data.type}.label`)}</span>
              {data.durationMinutes ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {minutes(data.durationMinutes)}
                </span>
              ) : null}
              {data.completed && (
                <span className="flex items-center gap-1 font-medium text-success">
                  <Check className="size-3.5" /> {t("learn.completed")}
                </span>
              )}
            </div>
          </div>
        </div>
        {data.summary && <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{data.summary}</p>}
      </header>

      <div className="mt-6 grid gap-8 sm:mt-8">
        {isAssessment ? (
          <>
            {data.body && <RichContent html={data.body} />}
            <AssessmentPanel item={data} />
          </>
        ) : (
          <>
            <ItemViewer item={data} />
            <RichContent html={data.body} />
          </>
        )}
        <ExtraAttachments attachments={extras} />
      </div>

      <footer className="mt-14 border-t pt-6">
        {!isAssessment && (
          <div
            className={cn(
              "mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center",
              data.completed ? "border-success/30 bg-success-soft/50" : "bg-card",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 transition-colors",
                  data.completed ? "border-success bg-success text-white" : "border-input text-muted-foreground",
                )}
              >
                {data.completed ? <Check className="size-4" strokeWidth={3} /> : <Check className="size-4 opacity-30" />}
              </span>
              <div>
                <p className="text-sm font-medium">{data.completed ? t("learn.doneTitle") : t("learn.finished")}</p>
                <p className="text-xs text-muted-foreground">
                  {data.completed ? (
                    t("learn.doneText")
                  ) : (
                    <>
                      {t("learn.markHint")}
                      <span className="hidden sm:inline">
                        {" "}
                        {t("learn.shortcut")} <Kbd>M</Kbd>
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant={data.completed ? "outline" : "default"}
              onClick={() => toggle.mutate(!data.completed)}
              aria-pressed={data.completed}
            >
              {data.completed ? (
                t("learn.markIncomplete")
              ) : (
                <>
                  <Check /> {t("learn.markComplete")}
                </>
              )}
            </Button>
          </div>
        )}
        <nav aria-label={t("learn.lessonNav")} className="flex items-center justify-between gap-3">
          {prevId ? (
            <Button variant="ghost" asChild>
              <Link href={`/learn/${courseId}/${prevId}`}>
                <ArrowLeft /> {t("learn.previous")}
                <Kbd className="ml-1 hidden sm:inline-flex">[</Kbd>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {nextId ? (
            <Button
              asChild
              onClick={() => {
                if (!isAssessment && !data.completed) toggle.mutate(true);
              }}
            >
              <Link href={`/learn/${courseId}/${nextId}`}>
                {!isAssessment && !data.completed ? t("learn.completeContinue") : t("learn.nextLesson")} <ArrowRight />
                <Kbd className="ml-1 hidden border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80 sm:inline-flex">]</Kbd>
              </Link>
            </Button>
          ) : (
            isLast && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <PartyPopper className="size-4 text-brand" /> {t("learn.end")}
              </span>
            )
          )}
        </nav>
      </footer>
    </article>
  );
}
