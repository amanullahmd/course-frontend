"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";

export function CheckEmail() {
  const t = useTranslations("auth.checkEmail");
  const email = useSearchParams().get("email") ?? "";
  return (
    <>
      <AuthHeading
        icon={MailCheck}
        tone="brand"
        title={t("title")}
        description={email ? t.rich("text", { email, b: (c) => <strong className="text-foreground">{c}</strong> }) : t("textNoEmail")}
      />
      <ol className="mb-8 grid gap-3 rounded-xl border bg-card p-4 text-sm">
        {[t("step1"), t("step2"), t("step3")].map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="grid gap-3">
        {email && <ResendVerificationButton email={email} className="w-full" />}
        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">{t("back")}</Link>
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">{t("spam")}</p>
    </>
  );
}
