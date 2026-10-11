"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { MailWarning, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";
import { makeEmailSchema } from "@/lib/validation";
import { safeNextPath } from "@/lib/utils";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useAuth } from "@/providers/auth-provider";
import { homeForRole } from "@/components/layout/nav-config";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [error, setError] = React.useState<{ message: string; unverified: boolean } | null>(null);
  const schema = React.useMemo(
    () => z.object({ email: makeEmailSchema((k) => t(`validation.${k}`)), password: z.string().min(1, t("validation.passwordRequired")) }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;
  const email = useWatch({ control: form.control, name: "email" });

  React.useEffect(() => {
    if (status === "authenticated" && user) router.replace(safeNextPath(next, homeForRole(user.role)));
  }, [status, user, next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const u = await login(values.email, values.password);
      toast.success(t("auth.login.welcome", { name: u.fullName.split(" ")[0] }));
      router.replace(safeNextPath(next, homeForRole(u.role)));
    } catch (err) {
      const unverified = isApiError(err) && err.code === "EMAIL_NOT_VERIFIED";
      const invalid = isApiError(err) && err.status === 401 && !err.code;
      setError({ message: invalid ? t("errors.codes.INVALID_CREDENTIALS") : errorMessage(err), unverified });
    }
  });

  return (
    <>
      <AuthHeading title={t("auth.login.title")} description={t("auth.login.subtitle")} />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {error && (
          <FormAlert
            tone={error.unverified ? "warning" : "error"}
            action={
              error.unverified && (
                <ResendVerificationButton email={email} size="sm" className="w-fit">
                  <MailWarning /> {t("auth.resend")}
                </ResendVerificationButton>
              )
            }
          >
            {error.message}
          </FormAlert>
        )}
        <Field label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder={t("auth.emailPlaceholder")} {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field
          label={t("auth.password")}
          htmlFor="password"
          error={errors.password?.message}
          labelAside={
            <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              {t("auth.login.forgot")}
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {t("auth.login.submit")}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.login.newHere")}{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-foreground underline-offset-4 hover:underline">
          {t("auth.login.createAccount")}
        </Link>
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" /> {t("auth.login.demo")}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                type="button"
                variant="secondary"
                size="sm"
                title={a.email}
                onClick={() => {
                  form.setValue("email", a.email, { shouldValidate: true });
                  form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
                }}
              >
                {t(`roles.${a.role}`)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("auth.login.demoHint")}</p>
        </div>
      )}
    </>
  );
}
