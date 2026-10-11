"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { AuthHeading } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";

export function CheckEmail() {
  const email = useSearchParams().get("email") ?? "";
  return (
    <>
      <AuthHeading
        icon={MailCheck}
        tone="brand"
        title="Check your inbox"
        description={
          <>
            We sent a verification link to {email ? <strong className="text-foreground">{email}</strong> : "your e-mail address"}.
            The link is valid for 24 hours.
          </>
        }
      />
      <ol className="mb-8 grid gap-3 rounded-xl border bg-card p-4 text-sm">
        {["Open the e-mail from Sprachweg", "Click “Verify e-mail address”", "Log in and start your path"].map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="grid gap-3">
        {email && <ResendVerificationButton email={email} className="w-full" />}
        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Can&apos;t find it? Check your spam folder.</p>
    </>
  );
}
