"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Eye, ListTree, Lock, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { isApiError } from "@/lib/api/client";
import type { LearnCourseDto } from "@/lib/api/types";
import { formatMinutes, cn } from "@/lib/utils";
import { useLearnCourse } from "@/hooks/queries/student";
import { usePersistentState } from "@/hooks/use-local-storage";
import { useAuth } from "@/providers/auth-provider";
import { LevelBadge } from "@/components/course/badges";
import { ItemTypeIcon } from "@/components/course/item-type-icon";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

function Outline({ data, activeItemId, onNavigate }: { data: LearnCourseDto; activeItemId?: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Course outline" className="grid gap-1">
      {data.modules.map((m, mi) => {
        const done = m.items.filter((i) => i.completed).length;
        const containsActive = m.items.some((i) => i.id === activeItemId);
        return (
          <Collapsible key={m.id} defaultOpen={containsActive || mi === 0}>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{m.title}</span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {done}/{m.items.length} completed
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-0.5 mb-2 grid gap-0.5">
                {m.items.map((item) => {
                  const active = item.id === activeItemId;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/learn/${data.course.id}/${item.id}`}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                          active && "bg-card font-medium text-foreground shadow-xs ring-1 ring-border",
                        )}
                      >
                        <ItemTypeIcon type={item.type} className="size-6 rounded-md [&_svg]:size-3.5" />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.durationMinutes ? (
                          <span className="shrink-0 text-[11px] tabular-nums">{formatMinutes(item.durationMinutes)}</span>
                        ) : null}
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded-full border",
                            item.completed ? "border-success bg-success text-white" : "border-input",
                          )}
                          aria-label={item.completed ? "Completed" : "Not completed"}
                        >
                          {item.completed && <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
}

function SidebarHeader({ data }: { data: LearnCourseDto }) {
  return (
    <div className="grid gap-3 border-b p-4">
      <Link href="/dashboard" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> My learning
      </Link>
      <div className="flex items-start gap-2">
        <LevelBadge level={data.course.level} />
        <p className="text-sm leading-snug font-semibold">{data.course.title}</p>
      </div>
      <div className="grid gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="font-medium text-foreground tabular-nums">{Math.round(data.progressPercent)}%</span>
        </div>
        <Progress value={data.progressPercent} indicatorClassName={data.progressPercent >= 100 ? "bg-success" : undefined} />
      </div>
    </div>
  );
}

interface LearnContextValue {
  openOutline: () => void;
  data: LearnCourseDto;
}
const LearnContext = React.createContext<LearnContextValue | null>(null);
export function useLearnContext() {
  const ctx = React.useContext(LearnContext);
  if (!ctx) throw new Error("useLearnContext must be used inside LearnShell");
  return ctx;
}

export function LearnShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ courseId: string; itemId?: string }>();
  const courseId = params.courseId;
  const { user } = useAuth();
  const course = useLearnCourse(courseId);
  const [collapsed, setCollapsed] = usePersistentState("sw.learn.sidebar.collapsed", false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const ctx = React.useMemo(
    () => (course.data ? { data: course.data, openOutline: () => setMobileOpen(true) } : null),
    [course.data],
  );

  if (course.isPending) {
    return (
      <div className="flex flex-1">
        <div className="hidden w-80 border-r p-4 lg:block">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="mt-4 h-2 w-full" />
          <div className="mt-8 grid gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-7" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 lg:p-10">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="mt-6 aspect-video w-full max-w-4xl rounded-xl" />
        </div>
      </div>
    );
  }

  if (course.isError || !ctx) {
    const status = isApiError(course.error) ? course.error.status : 0;
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20">
        {status === 403 || status === 404 ? (
          <EmptyState
            icon={Lock}
            title="This course isn't available to you yet"
            description="You can access the course once the instructor has approved your application and the content is published."
            action={
              <>
                <Button asChild>
                  <Link href="/dashboard">My learning</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/courses">Browse courses</Link>
                </Button>
              </>
            }
          />
        ) : (
          <ErrorState error={course.error} onRetry={() => course.refetch()} />
        )}
      </div>
    );
  }

  const isOwner = !!user && ctx.data.course.instructor.id === user.id;

  return (
    <LearnContext.Provider value={ctx}>
      {isOwner && (
        <div className="flex items-center justify-center gap-2 border-b bg-info-soft px-4 py-2 text-[13px] text-info">
          <Eye className="size-4" /> Student preview: you see only content that is live right now.
          <Link href={`/instructor/courses/${courseId}`} className="font-medium underline underline-offset-2">
            Back to builder
          </Link>
        </div>
      )}
      <div className="flex flex-1">
        <aside
          className={cn(
            "sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex",
            collapsed ? "w-0 overflow-hidden border-r-0" : "w-80",
          )}
          aria-hidden={collapsed}
        >
          <SidebarHeader data={ctx.data} />
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <Outline data={ctx.data} activeItemId={params.itemId} />
          </div>
        </aside>
        <div className="relative min-w-0 flex-1">
          <div className="sticky top-14 z-20 flex items-center gap-2 border-b bg-background/85 px-3 py-2 backdrop-blur lg:hidden">
            <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)}>
              <ListTree /> Outline
            </Button>
            <div className="min-w-0 flex-1">
              <Progress value={ctx.data.progressPercent} className="h-1.5" />
            </div>
            <span className="text-xs font-medium tabular-nums">{Math.round(ctx.data.progressPercent)}%</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 left-3 z-10 hidden lg:inline-flex"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Show outline" : "Hide outline"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          {children}
        </div>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw-2.5rem,22rem)] gap-0 p-0">
          <SheetTitle className="sr-only">Course outline</SheetTitle>
          <SheetDescription className="sr-only">Modules and lessons of this course</SheetDescription>
          <SidebarHeader data={ctx.data} />
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <Outline data={ctx.data} activeItemId={params.itemId} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </LearnContext.Provider>
  );
}
