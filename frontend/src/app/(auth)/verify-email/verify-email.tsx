"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle, MailX } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/client";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyEmail() {
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

  if (!token) {
    return <AuthHeading icon={MailX} tone="error" title="Missing verification link" description="Open the link from your e-mail again, or request a new one below." />;
  }

  if (verify.isPending) {
    return (
      <div className="grid place-items-center gap-4 py-10 text-center">
        <LoaderCircle className="size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground">Verifying your e-mail address…</p>
      </div>
    );
  }

  if (verify.isSuccess) {
    return (
      <>
        <AuthHeading
          icon={CircleCheck}
          tone="success"
          title="E-mail verified"
          description={verify.data?.message || "Your account is ready. Log in to start your learning path."}
        />
        <Button size="lg" className="w-full" asChild>
          <Link href="/login">Continue to login</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        icon={MailX}
        tone="error"
        title="This link didn't work"
        description={`${getErrorMessage(verify.error)} Verification links expire after 24 hours and can only be used once.`}
      />
      <div className="grid gap-3">
        <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your e-mail address" />
        <ResendVerificationButton email={email} className="w-full">
          Send a new link
        </ResendVerificationButton>
        <Button variant="ghost" asChild>
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    </>
  );
}
