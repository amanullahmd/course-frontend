"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useInstructorCourses } from "@/hooks/queries/instructor";
import { usePersistentState } from "@/hooks/use-local-storage";
import { useAuth } from "@/providers/auth-provider";
import { VISIBILITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { isActive, navForRole } from "./nav-config";

function SidebarInner({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const courses = useInstructorCourses();
  const items = navForRole(user?.role ?? "INSTRUCTOR").filter((i) => i.href !== "/courses");

  return (
    <>
      <nav aria-label="Instructor" className="grid gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-card text-foreground shadow-xs ring-1 ring-border",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && <span className="sr-only">{item.label}</span>}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            <React.Fragment key={item.href}>{link}</React.Fragment>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-2 flex items-center justify-between px-2.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Courses</p>
            <Tooltip content="New course">
              <Link
                href="/instructor/courses/new"
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="New course"
              >
                <Plus className="size-3.5" />
              </Link>
            </Tooltip>
          </div>
          {courses.isPending ? (
            <div className="grid gap-2 px-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <ul className="grid gap-0.5">
              {(courses.data ?? []).slice(0, 12).map((c) => {
                const href = `/instructor/courses/${c.id}`;
                const active = pathname.startsWith(href);
                return (
                  <li key={c.id}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                        active && "bg-accent text-foreground",
                      )}
                    >
                      <span className={cn("size-1.5 shrink-0 rounded-full", VISIBILITY_META[c.visibility].dot)} aria-hidden />
                      <span className="truncate">{c.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export function InstructorSidebar() {
  const [collapsed, setCollapsed] = usePersistentState("sw.sidebar.collapsed", false);
  return (
    <aside
      className={cn(
        "sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r bg-sidebar p-3 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[60px]" : "w-60",
      )}
    >
      <React.Suspense fallback={null}>
        <SidebarInner collapsed={collapsed} />
      </React.Suspense>
      <div className={cn("mt-auto pt-3", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(!collapsed && "w-full justify-start text-muted-foreground")}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && "Collapse"}
        </Button>
      </div>
    </aside>
  );
}
