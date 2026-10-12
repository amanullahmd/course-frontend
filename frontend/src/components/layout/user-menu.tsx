"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bell, LogOut, Settings, ShieldCheck, LayoutDashboard, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { ROLE_META } from "@/lib/constants";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LocaleSubmenu } from "./locale-switcher";
import { ThemeSegmented } from "./theme-toggle";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations();
  if (!user) return null;
  const isTeacher = user.role === "INSTRUCTOR" || user.role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={t("userMenu.open")}
      >
        <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-8 ring-1 ring-border" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar name={user.fullName} src={user.avatarUrl} className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="px-2 pb-2">
          <Badge variant="plain" className={ROLE_META[user.role].className}>
            {t(`roles.${user.role}`)}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> {t("userMenu.adminConsole")}
            </Link>
          </DropdownMenuItem>
        )}
        {isTeacher && (
          <DropdownMenuItem asChild>
            <Link href="/instructor">
              <LayoutDashboard /> {t("userMenu.instructorArea")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <BookOpen /> {t("userMenu.myLearning")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Bell /> {t("userMenu.notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> {t("userMenu.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#privacy">
            <LockKeyhole /> {t("privacy.menu")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <ThemeSegmented />
        </div>
        <LocaleSubmenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            toast.success(t("userMenu.signedOut"));
            router.push("/");
          }}
        >
          <LogOut /> {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
