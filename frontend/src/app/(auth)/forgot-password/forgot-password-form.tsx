"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/client";
import { emailSchema } from "@/lib/validation";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({ email: emailSchema });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  if (sentTo) {
    return (
      <>
        <AuthHeading
          icon={MailCheck}
          tone="success"
          title="Check your inbox"
          description={
            <>
              If an account exists for <strong className="text-foreground">{sentTo}</strong>, you&apos;ll receive a link to reset
              your password. It&apos;s valid for one hour.
            </>
          }
        />
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft /> Back to login
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={KeyRound} title="Forgot your password?" description="Enter your e-mail and we'll send you a reset link." />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={form.handleSubmit(async ({ email }) => {
          setError(null);
          try {
            await authApi.forgotPassword(email);
            setSentTo(email);
          } catch (err) {
            setError(getErrorMessage(err));
          }
        })}
      >
        {error && <FormAlert>{error}</FormAlert>}
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Send reset link
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/login">
            <ArrowLeft /> Back to login
          </Link>
        </Button>
      </form>
    </>
  );
}
