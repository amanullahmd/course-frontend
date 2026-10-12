"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, BarChart3, ChevronRight, Copy, Ellipsis, ExternalLink, Eye, FileCog, Inbox, Layers, Megaphone, Rocket, Trash, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { useFormat } from "@/hooks/use-format";
import { useDeleteCourse, useInstructorCourse, usePublishCourse, useUpdateCourse } from "@/hooks/queries/instructor";
import { PageContainer } from "@/components/layout/page-header";
import { LevelBadge } from "@/components/course/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CloneCourseDialog } from "./clone-course-dialog";
import { CourseForm } from "./course-form";
import { CurriculumBoard } from "./curriculum-board";
import { PublicationPopover } from "./publication-control";
import { PublishingPanel } from "./publishing-panel";
import { CourseActiveSwitch } from "./course-active-switch";
import { StudentsPanel } from "./students-panel";
import { ReportsPanel } from "@/components/reports/reports-panel";
import { AnnouncementsPanel } from "@/components/announcements/announcements-panel";
import { CertificatePanel } from "@/components/certificates/certificate-panel";
import { LivePanel } from "@/components/live/live-panel";
import { CourseSubmissionQueue } from "@/components/assignments/submission-queue";

const TABS = ["curriculum", "details", "publishing", "students", "announcements", "reports", "certificate", "live", "submissions"] as const;
type Tab = (typeof TABS)[number];

function BuilderSkeleton() {
  return (
    <PageContainer wide>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-9 w-96 max-w-full" />
      <Skeleton className="mt-8 h-10 w-full max-w-xl" />
      <div className="mt-6 grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </PageContainer>
  );
}

export function CourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const t = useTranslations();
  const fmt = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "curriculum";
  const course = useInstructorCourse(courseId);
  const update = useUpdateCourse(courseId);
  const publish = usePublishCourse(courseId);
  const del = useDeleteCourse();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [cloneOpen, setCloneOpen] = React.useState(false);

  const setTab = (t: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (t === "curriculum") sp.delete("tab");
    else sp.set("tab", t);
    if (t !== "reports") sp.delete("view");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (course.isPending) return <BuilderSkeleton />;
  if (course.isError) {
    const notFound = isApiError(course.error) && (course.error.status === 404 || course.error.status === 403);
    return (
      <PageContainer>
        {notFound ? (
          <EmptyState
            icon={Layers}
            title={t("builder.courseNotFound")}
            description={t("builder.courseNotFoundText")}
            action={
              <Button asChild>
                <Link href="/instructor/courses">{t("builder.backToCourses")}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={course.error} onRetry={() => course.refetch()} />
        )}
      </PageContainer>
    );
  }

  const c = course.data;
  const itemCount = c.modules.reduce((n, m) => n + m.items.length, 0);

  return (
    <PageContainer wide>
      <nav aria-label={t("builder.breadcrumb")} className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/instructor/courses" className="shrink-0 hover:text-foreground">
          {t("builder.myCourses")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="truncate text-foreground">{c.title}</span>
      </nav>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="line-clamp-3 text-2xl font-semibold tracking-tight break-words text-balance sm:text-[28px]">{c.title}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <LevelBadge level={c.level} />
            <PublicationPopover
              entity={c}
              entityLabel="course"
              align="start"
              pending={publish.isPending}
              onSubmit={(body) => publish.mutateAsync(body)}
            />
            <span className="hidden sm:inline">·</span>
            <span>
              {t("course.modulesCount", { count: c.modules.length })} · {t("course.itemsCount", { count: itemCount })} ·{" "}
              {t("course.learnersCount", { count: c.studentCount })}
            </span>
            <span className="hidden sm:inline">· {t("builder.updated", { when: fmt.relative(c.updatedAt) })}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CourseActiveSwitch course={c} className="mr-1 h-8 rounded-lg border bg-card px-2.5" />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/learn/${c.id}`}>
              <Eye /> {t("builder.preview")}
            </Link>
          </Button>
          {c.visibility === "LIVE" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${c.slug}`} target="_blank">
                <ExternalLink /> {t("builder.publicPage")}
              </Link>
            </Button>
          )}
          {c.visibility !== "LIVE" && (
            <PublicationPopover
              entity={c}
              entityLabel="course"
              trigger="primary"
              pending={publish.isPending}
              onSubmit={(body) => publish.mutateAsync(body)}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label={t("builder.more")}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setTab("details")}>
                <FileCog /> {t("builder.editDetails")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTab("publishing")}>
                <Rocket /> {t("builder.publishing")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCloneOpen(true)}>
                <Copy /> {t("clone.action")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                <Trash /> {t("builder.deleteCourse")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList variant="underline">
          <TabsTrigger value="curriculum">
            <Layers /> {t("builder.tabs.curriculum")}
          </TabsTrigger>
          <TabsTrigger value="details">
            <FileCog /> {t("builder.tabs.details")}
          </TabsTrigger>
          <TabsTrigger value="publishing">
            <Rocket /> {t("builder.tabs.publishing")}
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users /> {t("builder.tabs.students")}
            {c.pendingCount > 0 && (
              <Badge variant="info" className="px-1.5">
                {c.pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live">
            <Video /> {t("builder.tabs.live")}
          </TabsTrigger>
          <TabsTrigger value="submissions">
            <Inbox /> {t("builder.tabs.submissions")}
          </TabsTrigger>
          <TabsTrigger value="announcements">
            <Megaphone /> {t("builder.tabs.announcements")}
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 /> {t("builder.tabs.reports")}
          </TabsTrigger>
          <TabsTrigger value="certificate">
            <Award /> {t("builder.tabs.certificate")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="curriculum" className="mt-6">
          <CurriculumBoard course={c} />
        </TabsContent>
        <TabsContent value="details" className="mt-6 max-w-3xl">
          <CourseForm
            course={c}
            submitLabel={t("common.saveChanges")}
            onSubmit={(body) => update.mutateAsync(body).then(() => toast.success(t("builder.detailsSaved")))}
          />
        </TabsContent>
        <TabsContent value="publishing" className="mt-6">
          <PublishingPanel course={c} />
        </TabsContent>
        <TabsContent value="students" className="mt-6">
          <StudentsPanel courseId={c.id} capacity={c.capacity} />
        </TabsContent>
        <TabsContent value="live" className="mt-6">
          <LivePanel courseId={c.id} />
        </TabsContent>
        <TabsContent value="submissions" className="mt-6">
          <CourseSubmissionQueue courseId={c.id} />
        </TabsContent>
        <TabsContent value="announcements" className="mt-6">
          <AnnouncementsPanel courseId={c.id} />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <ReportsPanel courseId={c.id} courseTitle={c.title} />
        </TabsContent>
        <TabsContent value="certificate" className="mt-6">
          <CertificatePanel courseId={c.id} courseSlug={c.slug} />
        </TabsContent>
      </Tabs>

      <CloneCourseDialog course={c} open={cloneOpen} onOpenChange={setCloneOpen} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("builder.deleteTitle", { title: c.title })}
        description={t("builder.deleteText")}
        confirmLabel={t("builder.deleteCourse")}
        destructive
        loading={del.isPending}
        onConfirm={() =>
          del.mutate(c.id, {
            onSuccess: () => {
              toast.success(t("builder.deleted"));
              router.push("/instructor/courses");
            },
          })
        }
      />
    </PageContainer>
  );
}
