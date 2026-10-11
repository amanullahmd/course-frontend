"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, KeyRound, LoaderCircle, Trash, UserRound } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage, isApiError } from "@/lib/api/client";
import { mediaApi } from "@/lib/api/media";
import { meApi } from "@/lib/api/me";
import type { UserDto } from "@/lib/api/types";
import { ROLE_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { applyServerErrors } from "@/lib/form-errors";
import { passwordSchema } from "@/lib/validation";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  bio: z.string().max(2000),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileCard({ user }: { user: UserDto }) {
  const { setUser } = useAuth();
  const [avatar, setAvatar] = React.useState<{ id: string | null; url: string | null }>({
    id: user.avatarMediaId ?? null,
    url: user.avatarUrl,
  });
  const [avatarChanged, setAvatarChanged] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName, bio: user.bio ?? "" } });
  const { errors, isSubmitting, isDirty } = form.formState;
  const fullName = useWatch({ control: form.control, name: "fullName" });

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    setProgress(0);
    try {
      const media = await mediaApi.upload(file, { onProgress: setProgress });
      setAvatar({ id: media.id, url: media.url });
      setAvatarChanged(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setProgress(null);
    }
  };

  const submit = form.handleSubmit(async (v) => {
    try {
      const updated = await meApi.update({
        fullName: v.fullName.trim(),
        bio: v.bio.trim() || null,
        avatarMediaId: avatarChanged ? avatar.id : (user.avatarMediaId ?? null),
      });
      setUser(updated);
      setAvatarChanged(false);
      form.reset({ fullName: updated.fullName, bio: updated.bio ?? "" });
      toast.success("Profile updated");
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ["fullName", "bio"])) toast.error(getErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4" /> Profile
        </CardTitle>
        <CardDescription>Your name and bio appear on your courses and in applications.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={fullName} src={avatar.url} className="size-20 text-2xl" />
              {progress !== null && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-xs font-medium text-white">
                  <LoaderCircle className="size-5 animate-spin" />
                </span>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
                  <Camera /> {progress !== null ? `Uploading ${progress}%` : "Change photo"}
                </Button>
                {avatar.url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAvatar({ id: null, url: null });
                      setAvatarChanged(true);
                    }}
                  >
                    <Trash /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Square images work best. JPG or PNG.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
            <Input autoComplete="name" {...fieldA11y("fullName", errors.fullName?.message)} {...form.register("fullName")} />
          </Field>
          <Field label="E-mail" htmlFor="email" hint="Contact support to change your e-mail address.">
            <Input id="email" value={user.email} disabled readOnly />
          </Field>
          <Field label="Bio" htmlFor="bio" error={errors.bio?.message} hint="A few sentences about you: your teaching style, or why you're learning German.">
            <Textarea rows={5} {...fieldA11y("bio", errors.bio?.message)} {...form.register("bio")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty && !avatarChanged}>
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const passwordFormSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type PasswordValues = z.infer<typeof passwordFormSchema>;

function PasswordCard() {
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const change = useMutation({
    mutationFn: (v: PasswordValues) => meApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }),
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      toast.success("Password changed");
      form.reset();
    },
    onError: (err) => {
      if (isApiError(err) && (err.status === 400 || err.status === 401 || err.code === "INVALID_CREDENTIALS") && !Object.keys(err.fieldErrors).length) {
        form.setError("currentPassword", { message: "The current password is incorrect." });
      } else if (!applyServerErrors(err, form.setError, ["currentPassword", "newPassword"])) toast.error(getErrorMessage(err));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Password
        </CardTitle>
        <CardDescription>Use at least 8 characters with a letter and a digit.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="grid gap-5" noValidate>
          <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...fieldA11y("currentPassword", errors.currentPassword?.message)} {...form.register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" {...fieldA11y("newPassword", errors.newPassword?.message)} {...form.register("newPassword")} />
            <PasswordStrengthMeter password={newPassword} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...fieldA11y("confirm", errors.confirm?.message)} {...form.register("confirm")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={change.isPending}>
              Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Settings"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Member since {formatDate(user.createdAt, "MMMM yyyy")}
            <Badge variant="plain" className={ROLE_META[user.role].className}>
              {ROLE_META[user.role].label}
            </Badge>
          </span>
        }
      />
      <div className="mt-8 grid gap-6">
        <ProfileCard key={user.id} user={user} />
        <PasswordCard />
      </div>
    </PageContainer>
  );
}
