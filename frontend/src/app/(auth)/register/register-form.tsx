"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Presentation } from "lucide-react";
import { getErrorMessage, isApiError } from "@/lib/api/client";
import { applyServerErrors } from "@/lib/form-errors";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { useAuth } from "@/providers/auth-provider";
import { AuthHeading, FormAlert } from "@/components/auth/auth-card";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";

const schema = z.object({
  role: z.enum(["STUDENT", "INSTRUCTOR"]),
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "That name is too long"),
  email: emailSchema,
  password: passwordSchema,
});
type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: params.get("role") === "INSTRUCTOR" ? "INSTRUCTOR" : "STUDENT",
      fullName: "",
      email: "",
      password: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await registerUser(values);
      router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const mapped = applyServerErrors(err, form.setError, ["fullName", "email", "password", "role"]);
      if (isApiError(err) && err.status === 409) {
        form.setError("email", { message: "An account with this e-mail already exists." });
      } else if (!mapped) {
        setError(getErrorMessage(err));
      }
    }
  });

  return (
    <>
      <AuthHeading title="Create your account" description="Free for learners and teachers. Takes less than a minute." />
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        {error && <FormAlert>{error}</FormAlert>}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">I want to…</legend>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3" aria-label="Account type">
                <RadioCard value="STUDENT" icon={<GraduationCap />} title="Learn German" description="Apply to courses and track progress" />
                <RadioCard value="INSTRUCTOR" icon={<Presentation />} title="Teach German" description="Build and publish your own courses" />
              </RadioGroup>
            )}
          />
        </fieldset>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input autoComplete="name" placeholder="Luca Bianchi" {...fieldA11y("fullName", errors.fullName?.message)} {...form.register("fullName")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="you@example.com" {...fieldA11y("email", errors.email?.message)} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...fieldA11y("password", errors.password?.message)} {...form.register("password")} />
          <PasswordStrengthMeter password={password} />
        </Field>
        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Create account
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll send you an e-mail to confirm your address before you can log in.
        </p>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
