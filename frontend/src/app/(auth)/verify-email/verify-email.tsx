"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CircleCheck, LoaderCircle, MailX } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { useErrorMessage } from "@/hooks/use-error-message";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyEmail() {
  const t = useTranslations("auth.verify");
  const ta = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const token = useSearchParams().get("token") ?? "";
  // A query (not an effect) so the single-use token is sent exactly once, even in StrictMode.
  const verify = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => authApi.verifyEmail(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const [email, setEmail] = React.useState("");

  if (!token) return <AuthHeading icon={MailX} tone="error" title={t("missingTitle")} description={t("missingText")} />;

  if (verify.isPending) {
    return (
      <div className="grid place-items-center gap-4 py-10 text-center">
        <LoaderCircle className="size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <>
        <AuthHeading icon={CircleCheck} tone="success" title={t("successTitle")} description={verify.data?.message || t("successText")} />
        <Button size="lg" className="w-full" asChild>
          <Link href="/login">{t("continue")}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={MailX} tone="error" title={t("failTitle")} description={`${errorMessage(verify.error)} ${t("failHint")}`} />
      <div className="grid gap-3">
        <Input type="email" placeholder={ta("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={t("yourEmail")} />
        <ResendVerificationButton email={email} className="w-full">
          {t("sendNew")}
        </ResendVerificationButton>
        <Button variant="ghost" asChild>
          <Link href="/login">{ta("checkEmail.back")}</Link>
        </Button>
      </div>
    </>
  );
}
