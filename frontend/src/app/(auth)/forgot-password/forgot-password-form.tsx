"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { makeEmailSchema } from "@/lib/validation";
import { useErrorMessage } from "@/hooks/use-error-message";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const schema = React.useMemo(() => z.object({ email: makeEmailSchema((k) => t(`validation.${k}`)) }), [t]);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;

  if (sentTo) {
    return (
      <>
        <AuthHeading
          icon={MailCheck}
          tone="success"
          title={t("auth.forgot.sentTitle")}
          description={t.rich("auth.forgot.sentText", { email: sentTo, b: (c) => <strong className="text-foreground">{c}</strong> })}
        />
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">
            <ArrowLeft /> {t("auth.checkEmail.back")}
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={KeyRound} title={t("auth.forgot.title")} description={t("auth.forgot.subtitle")} />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={form.handleSubmit(async ({ email }) => {
          setError(null);
          try {
            await authApi.forgotPassword(email);
            setSentTo(email);
          } catch (err) {
            setError(errorMessage(err));
          }
        })}
      >
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {t("auth.forgot.submit")}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/login">
            <ArrowLeft /> {t("auth.checkEmail.back")}
          </Link>
        </Button>
      </form>
    </>
  );
}
