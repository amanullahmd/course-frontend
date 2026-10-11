"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleCheck, KeyRound, MailX } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/client";
import { applyServerErrors } from "@/lib/form-errors";
import { passwordSchema } from "@/lib/validation";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  if (!token) {
    return (
      <>
        <AuthHeading icon={MailX} tone="error" title="Invalid reset link" description="This link is incomplete. Request a new one to continue." />
        <Button className="w-full" asChild>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthHeading icon={CircleCheck} tone="success" title="Password updated" description="You can now log in with your new password." />
        <Button size="lg" className="w-full" asChild>
          <Link href="/login">Continue to login</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={KeyRound} title="Choose a new password" description="Reset links are valid for one hour and can be used once." />
      <form
        noValidate
        className="grid gap-5"
        onSubmit={form.handleSubmit(async ({ password }) => {
          setError(null);
          try {
            await authApi.resetPassword(token, password);
            setDone(true);
          } catch (err) {
            if (!applyServerErrors(err, form.setError, ["password"])) setError(getErrorMessage(err));
          }
        })}
      >
        {error && (
          <FormAlert
            action={
              <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
                Request a new link
              </Link>
            }
          >
            {error}
          </FormAlert>
        )}
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
          <PasswordStrengthMeter password={password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("confirm", errors.confirm?.message)} {...form.register("confirm")} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  );
}
