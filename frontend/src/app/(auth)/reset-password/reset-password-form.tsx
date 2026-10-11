"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { CircleCheck, KeyRound, MailX } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { applyServerErrors } from "@/lib/form-errors";
import { makePasswordSchema } from "@/lib/validation";
import { useErrorMessage } from "@/hooks/use-error-message";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";

export function ResetPasswordForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const schema = React.useMemo(
    () =>
      z
        .object({ password: makePasswordSchema((k) => t(`validation.${k}`)), confirm: z.string() })
        .refine((v) => v.password === v.confirm, { path: ["confirm"], message: t("validation.passwordsMatch") }),
    [t],
  );
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  if (!token) {
    return (
      <>
        <AuthHeading icon={MailX} tone="error" title={t("auth.reset.invalidTitle")} description={t("auth.reset.invalidText")} />
        <Button className="w-full" asChild>
          <Link href="/forgot-password">{t("auth.reset.requestNew")}</Link>
        </Button>
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthHeading icon={CircleCheck} tone="success" title={t("auth.reset.doneTitle")} description={t("auth.reset.doneText")} />
        <Button size="lg" className="w-full" asChild>
          <Link href="/login">{t("auth.verify.continue")}</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={KeyRound} title={t("auth.reset.title")} description={t("auth.reset.subtitle")} />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={form.handleSubmit(async ({ password: pw }) => {
          setError(null);
          try {
            await authApi.resetPassword(token, pw);
            setDone(true);
          } catch (err) {
            if (!applyServerErrors(err, form.setError, ["password"])) setError(errorMessage(err));
          }
        })}
      >
        {error && (
          <FormAlert
            action={
              <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
                {t("auth.reset.requestNew")}
              </Link>
            }
          >
            {error}
          </FormAlert>
        )}
        <Field label={t("auth.reset.newPassword")} htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
          <PasswordStrengthMeter password={password} />
        </Field>
        <Field label={t("auth.reset.confirm")} htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("confirm", errors.confirm?.message)} {...form.register("confirm")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {t("auth.reset.submit")}
        </Button>
      </form>
    </>
  );
}
