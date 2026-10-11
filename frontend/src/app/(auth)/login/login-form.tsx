"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailWarning, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { isApiError, getErrorMessage } from "@/lib/api/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";
import { emailSchema } from "@/lib/validation";
import { safeNextPath } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { homeForRole } from "@/components/layout/nav-config";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { ResendVerificationButton } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const { login, status, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [error, setError] = React.useState<{ message: string; unverified: boolean } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (status === "authenticated" && user) router.replace(safeNextPath(next, homeForRole(user.role)));
  }, [status, user, next, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const u = await login(values.email, values.password);
      toast.success(`Willkommen zurück, ${u.fullName.split(" ")[0]}!`);
      router.replace(safeNextPath(next, homeForRole(u.role)));
    } catch (err) {
      if (isApiError(err) && err.code === "EMAIL_NOT_VERIFIED") {
        setError({ message: "Please verify your e-mail address before logging in.", unverified: true });
      } else if (isApiError(err) && err.status === 401) {
        setError({ message: "The e-mail or password is incorrect.", unverified: false });
      } else if (isApiError(err) && err.status === 403) {
        setError({ message: err.detail || "This account has been disabled. Contact support.", unverified: false });
      } else {
        setError({ message: getErrorMessage(err), unverified: false });
      }
    }
  });

  const email = useWatch({ control: form.control, name: "email" });

  return (
    <>
      <AuthHeading title="Welcome back" description="Log in to continue your learning path." />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {error && (
          <FormAlert
            tone={error.unverified ? "warning" : "error"}
            action={
              error.unverified && (
                <ResendVerificationButton email={email} size="sm" className="w-fit">
                  <MailWarning /> Resend verification e-mail
                </ResendVerificationButton>
              )
            }
          >
            {error.message}
          </FormAlert>
        )}
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          labelAside={
            <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Sprachweg?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" /> Demo accounts (development only)
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
                {a.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Fills the form with the seeded credentials.</p>
        </div>
      )}
    </>
  );
}
