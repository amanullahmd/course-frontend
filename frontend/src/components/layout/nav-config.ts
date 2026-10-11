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
  label: string;
  icon: LucideIcon;
  /** Match nested routes too (default true). */
  prefix?: boolean;
  exact?: boolean;
}

export function navForRole(role: Role): NavItem[] {
  switch (role) {
    case "ADMIN":
      return [
        { href: "/admin", label: "Admin", icon: ShieldCheck },
        { href: "/instructor", label: "Teaching", icon: LayoutDashboard, exact: true },
        { href: "/instructor/courses", label: "My courses", icon: Library },
        { href: "/instructor/schedule", label: "Schedule", icon: CalendarDays },
        { href: "/courses", label: "Catalog", icon: Compass },
      ];
    case "INSTRUCTOR":
      return [
        { href: "/instructor", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/instructor/courses", label: "My courses", icon: Library },
        { href: "/instructor/schedule", label: "Schedule", icon: CalendarDays },
        { href: "/courses", label: "Catalog", icon: Compass },
      ];
    default:
      return [
        { href: "/dashboard", label: "My learning", icon: BookOpen },
        { href: "/courses", label: "Browse courses", icon: Compass },
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
