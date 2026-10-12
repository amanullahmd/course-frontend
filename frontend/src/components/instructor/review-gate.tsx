"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, Hourglass, RotateCw, UserRoundPen, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { meApi } from "@/lib/api/me";
import { Button } from "@/components/ui/button";

/**
 * Instructor accounts must be approved by an admin before they can create courses. While the account is PENDING (or
 * was REJECTED) the instructor area shows a friendly review state instead of the builder; the backend enforces the
 * same rule (403 INSTRUCTOR_NOT_APPROVED).
 */
export function InstructorReviewGate({ children }: { children: React.ReactNode }) {
  const { user, reloadUser, setUser } = useAuth();
  const t = useTranslations("security.review");
  const [checking, setChecking] = React.useState(false);
  const status = user?.role === "INSTRUCTOR" ? user.instructorStatus : null;
  const blocked = status === "PENDING" || status === "REJECTED";

  // The cached user may be older than the admin's decision: refresh once when the gate is shown.
  React.useEffect(() => {
    if (blocked) void reloadUser().catch(() => undefined);
  }, [blocked, reloadUser]);

  if (!blocked) return <>{children}</>;

  const check = async () => {
    setChecking(true);
    try {
      const fresh = await meApi.get();
      setUser(fresh);
      if (fresh.instructorStatus === "APPROVED") toast.success(t("approvedNow"));
      else toast.info(t("stillPending"));
    } catch {
      toast.error(t("checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  const rejected = status === "REJECTED";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-16 text-center sm:py-24">
      <span
        className={
          rejected
            ? "grid size-14 place-items-center rounded-2xl bg-destructive-soft text-destructive"
            : "grid size-14 place-items-center rounded-2xl bg-warning-soft text-warning"
        }
      >
        {rejected ? <XCircle className="size-7" /> : <Hourglass className="size-7" />}
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{rejected ? t("rejectedTitle") : t("pendingTitle")}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{rejected ? t("rejectedText") : t("pendingText")}</p>
      {!rejected && (
        <ol className="mt-8 grid w-full gap-3 text-left text-sm">
          {(["step1", "step2", "step3"] as const).map((step, i) => (
            <li key={step} className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
              <span>{t(step)}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {!rejected && (
          <Button onClick={() => void check()} loading={checking}>
            <RotateCw /> {t("checkAgain")}
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/settings">
            <UserRoundPen /> {t("editProfile")}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/courses">
            <Compass /> {t("browse")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
