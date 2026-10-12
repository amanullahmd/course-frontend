"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CircleCheck, LoaderCircle, MailX } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { loginHref, rememberedNext } from "@/lib/post-auth-next";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const noopSubscribe = () => () => undefined;

export function VerifyEmail() {
  const t = useTranslations("auth.verify");
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
  // Continue where sign-up started (e.g. the course page of an invitation); read after mount (localStorage).
  const login = React.useSyncExternalStore(noopSubscribe, () => loginHref(rememberedNext()), () => "/login");
  if (!token) {
    return (
      <>
        <AuthHeading icon={MailX} tone="error" title={t("missingTitle")} description={t("missingText")} />
        <ResendForm />
      </>
    );
  }

  if (verify.isPending) {
    return (
      <div className="grid place-items-center gap-4 py-10 text-center" role="status">
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
          <Link href={login}>{t("continue")}</Link>
        </Button>
      </>
    );
  }

  // A used link most likely means the address is already verified (e.g. the link was clicked twice).
  if (isApiError(verify.error) && verify.error.code === "TOKEN_USED") {
    return (
      <>
        <AuthHeading icon={CircleCheck} tone="success" title={t("usedTitle")} description={t("usedText")} />
        <Button size="lg" className="w-full" asChild>
          <Link href={login}>{t("continue")}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={MailX} tone="error" title={t("failTitle")} description={`${errorMessage(verify.error)} ${t("failHint")}`} />
      <ResendForm />
    </>
  );
}

function ResendForm() {
  const t = useTranslations("auth.verify");
  const ta = useTranslations("auth");
  const [email, setEmail] = React.useState("");
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <div className="grid gap-3">
      <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={ta("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t("yourEmail")}
        />
        <ResendVerificationButton email={valid ? email.trim() : ""} className="w-full">
          {t("sendNew")}
        </ResendVerificationButton>
      </form>
      <Button variant="ghost" asChild>
        <Link href="/login">{ta("checkEmail.back")}</Link>
      </Button>
    </div>
  );
}
