"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, KeyRound, LoaderCircle, Trash, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isApiError } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useFormat } from "@/hooks/use-format";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { mediaApi } from "@/lib/api/media";
import { meApi } from "@/lib/api/me";
import type { UserDto } from "@/lib/api/types";
import { ROLE_META } from "@/lib/constants";
import { applyServerErrors } from "@/lib/form-errors";
import { makePasswordSchema } from "@/lib/validation";
import { useAuth } from "@/providers/auth-provider";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { PasswordInput, PasswordStrengthMeter } from "@/components/auth/password-input";
import { PrivacyCard } from "@/components/privacy/privacy-card";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProfileValues = { fullName: string; bio: string };

function ProfileCard({ user }: { user: UserDto }) {
  const { setUser } = useAuth();
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const profileSchema = React.useMemo(
    () =>
      z.object({
        fullName: z.string().trim().min(2, t("validation.fullName")).max(120, t("validation.tooLong")),
        bio: z.string().max(2000, t("validation.tooLong")),
      }),
    [t],
  );
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
    if (!file.type.startsWith("image/")) return toast.error(t("settings.chooseImage"));
    setProgress(0);
    try {
      const media = await mediaApi.upload(file, { onProgress: setProgress });
      setAvatar({ id: media.id, url: media.url });
      setAvatarChanged(true);
    } catch (err) {
      toast.error(errorMessage(err));
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
      toast.success(t("settings.updated"));
    } catch (err) {
      if (!applyServerErrors(err, form.setError, ["fullName", "bio"])) toast.error(errorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4" /> {t("settings.profile")}
        </CardTitle>
        <CardDescription>{t("settings.profileText")}</CardDescription>
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
                  <Camera /> {progress !== null ? t("settings.uploading", { percent: progress }) : t("settings.changePhoto")}
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
                    <Trash /> {t("settings.removePhoto")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("settings.photoHint")}</p>
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
          <Field label={t("settings.fullName")} htmlFor="fullName" error={errors.fullName?.message}>
            <Input autoComplete="name" {...fieldA11y("fullName", errors.fullName?.message)} {...form.register("fullName")} />
          </Field>
          <Field label={t("settings.email")} htmlFor="email" hint={t("settings.emailHint")}>
            <Input id="email" value={user.email} disabled readOnly />
          </Field>
          <Field label={t("settings.bio")} htmlFor="bio" error={errors.bio?.message} hint={t("settings.bioHint")}>
            <Textarea rows={5} {...fieldA11y("bio", errors.bio?.message)} {...form.register("bio")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty && !avatarChanged}>
              {t("settings.saveProfile")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type PasswordValues = { currentPassword: string; newPassword: string; confirm: string };

function PasswordCard() {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const passwordFormSchema = React.useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("validation.currentPassword")),
          newPassword: makePasswordSchema((k) => t(`validation.${k}`)),
          confirm: z.string(),
        })
        .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: t("validation.passwordsMatch") }),
    [t],
  );
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const { errors } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  const change = useMutation({
    mutationFn: (v: PasswordValues) => meApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }),
    meta: { suppressErrorToast: true },
    onSuccess: () => {
      toast.success(t("settings.passwordChanged"));
      form.reset();
    },
    onError: (err) => {
      if (isApiError(err) && (err.status === 400 || err.status === 401 || err.code === "INVALID_CREDENTIALS") && !Object.keys(err.fieldErrors).length) {
        form.setError("currentPassword", { message: t("validation.currentPasswordWrong") });
      } else if (!applyServerErrors(err, form.setError, ["currentPassword", "newPassword"])) toast.error(errorMessage(err));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> {t("settings.password")}
        </CardTitle>
        <CardDescription>{t("settings.passwordText")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="grid gap-5" noValidate>
          <Field label={t("settings.currentPassword")} htmlFor="currentPassword" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...fieldA11y("currentPassword", errors.currentPassword?.message)} {...form.register("currentPassword")} />
          </Field>
          <Field label={t("settings.newPassword")} htmlFor="newPassword" error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" {...fieldA11y("newPassword", errors.newPassword?.message)} {...form.register("newPassword")} />
            <PasswordStrengthMeter password={newPassword} />
          </Field>
          <Field label={t("settings.confirmPassword")} htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...fieldA11y("confirm", errors.confirm?.message)} {...form.register("confirm")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={change.isPending}>
              {t("settings.changePassword")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const { user } = useAuth();
  const t = useTranslations();
  const fmt = useFormat();
  if (!user) return null;
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title={t("settings.title")}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {t("settings.memberSince", { date: fmt.date(user.createdAt, "MMMM yyyy") })}
            <Badge variant="plain" className={ROLE_META[user.role].className}>
              {t(`roles.${user.role}`)}
            </Badge>
          </span>
        }
      />
      <div className="mt-8 grid gap-6">
        <ProfileCard key={user.id} user={user} />
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.language")}</CardTitle>
            <CardDescription>{t("settings.languageText")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LocaleSwitcher variant="full" className="min-w-40" />
          </CardContent>
        </Card>
        <PasswordCard />
        <PrivacyCard user={user} />
      </div>
    </PageContainer>
  );
}
