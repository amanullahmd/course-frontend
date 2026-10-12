"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { GraduationCap, Presentation } from "lucide-react";
import { isApiError } from "@/lib/api/client";
import { applyServerErrors } from "@/lib/form-errors";
import { loginHref, rememberNext } from "@/lib/post-auth-next";
import { safeNextPath } from "@/lib/utils";
import { makeEmailSchema, makePasswordSchema, type ValidationT } from "@/lib/validation";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useAuth } from "@/providers/auth-provider";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";

export function RegisterForm() {
  const t = useTranslations();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // Invitation links: /register?email=<address>&next=/courses/<slug> (only relative paths are honoured).
  const next = safeNextPath(params.get("next"), "") || null;
  const [error, setError] = React.useState<string | null>(null);
  const schema = React.useMemo(() => {
    const vt: ValidationT = (k) => t(`validation.${k}`);
    return z.object({
      role: z.enum(["STUDENT", "INSTRUCTOR"]),
      fullName: z.string().trim().min(2, t("validation.fullName")).max(120, t("validation.tooLong")),
      email: makeEmailSchema(vt),
      password: makePasswordSchema(vt),
      acceptTerms: z.boolean().refine((v) => v, t("legal.acceptTermsRequired")),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: params.get("role") === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT", fullName: "", email: (params.get("email") ?? "").trim().slice(0, 254), password: "", acceptTerms: false },
  });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });
  const role = useWatch({ control: form.control, name: "role" });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await registerUser({ ...values, locale });
      rememberNext(next);
      router.push(`/check-email?email=${encodeURIComponent(values.email)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
    } catch (err) {
      const mapped = applyServerErrors(err, form.setError, ["fullName", "email", "password", "role", "acceptTerms"]);
      if (isApiError(err) && (err.status === 409 || err.code === "EMAIL_TAKEN")) {
        form.setError("email", { message: t("errors.codes.EMAIL_TAKEN") });
      } else if (!mapped) {
        setError(errorMessage(err));
      }
    }
  });

  return (
    <>
      <AuthHeading title={t("auth.register.title")} description={t("auth.register.subtitle")} />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{t("auth.register.iWantTo")}</legend>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3" aria-label={t("auth.register.accountType")}>
                <RadioCard value="STUDENT" icon={<GraduationCap />} title={t("auth.register.learn")} description={t("auth.register.learnText")} />
                <RadioCard value="INSTRUCTOR" icon={<Presentation />} title={t("auth.register.teach")} description={t("auth.register.teachText")} />
              </RadioGroup>
            )}
          />
          {role === "INSTRUCTOR" && <p className="text-xs text-muted-foreground">{t("security.review.registerHint")}</p>}
        </fieldset>
        <Field label={t("auth.register.fullName")} htmlFor="fullName" error={errors.fullName?.message}>
          <Input autoComplete="name" placeholder="Luca Bianchi" {...fieldA11y("fullName", errors.fullName?.message)} {...form.register("fullName")} />
        </Field>
        <Field label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder={t("auth.emailPlaceholder")} {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field label={t("auth.password")} htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
          <PasswordStrengthMeter password={password} />
        </Field>
        <div className="grid gap-1.5">
          <div className="flex items-start gap-2.5">
            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  checked={field.value}
                  onCheckedChange={(c) => field.onChange(c === true)}
                  onBlur={field.onBlur}
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <label htmlFor="acceptTerms" className="text-sm leading-snug text-muted-foreground">
              {t.rich("legal.acceptTerms", {
                terms: (chunks) => (
                  <Link href="/agb" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/datenschutz" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </label>
          </div>
          {errors.acceptTerms?.message && (
            <p id="acceptTerms-error" role="alert" className="text-[13px] text-destructive">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t("auth.register.submit")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("auth.register.verifyNote")}</p>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.register.haveAccount")}{" "}
        <Link href={loginHref(next)} className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("auth.register.login")}
        </Link>
      </p>
    </>
  );
}
