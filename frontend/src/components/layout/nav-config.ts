import {
  BookOpen,
  CalendarDays,
  Compass,
  LayoutDashboard,
  Library,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/types";

export interface NavItem {
  href: string;
  /** Key in the "nav" messages namespace. */
  label: "admin" | "teaching" | "myCourses" | "schedule" | "catalog" | "overview" | "myLearning" | "browseCourses";
  icon: LucideIcon;
  /** Match nested routes too (default true). */
  prefix?: boolean;
  exact?: boolean;
}

export function navForRole(role: Role): NavItem[] {
  switch (role) {
    case "ADMIN":
      return [
        { href: "/admin", label: "admin", icon: ShieldCheck },
        { href: "/instructor", label: "teaching", icon: LayoutDashboard, exact: true },
        { href: "/instructor/courses", label: "myCourses", icon: Library },
        { href: "/instructor/schedule", label: "schedule", icon: CalendarDays },
        { href: "/courses", label: "catalog", icon: Compass },
      ];
    case "INSTRUCTOR":
      return [
        { href: "/instructor", label: "overview", icon: LayoutDashboard, exact: true },
        { href: "/instructor/courses", label: "myCourses", icon: Library },
        { href: "/instructor/schedule", label: "schedule", icon: CalendarDays },
        { href: "/courses", label: "catalog", icon: Compass },
      ];
    default:
      return [
        { href: "/dashboard", label: "myLearning", icon: BookOpen },
        { href: "/courses", label: "browseCourses", icon: Compass },
      ];
  }
}

export function homeForRole(role: Role | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "INSTRUCTOR") return "/instructor";
  return "/dashboard";
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
