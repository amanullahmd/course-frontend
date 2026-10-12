"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authApi } from "@/lib/api/auth";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button, type ButtonProps } from "@/components/ui/button";

const COOLDOWN = 30;

export function ResendVerificationButton({ email, ...props }: { email: string } & Omit<ButtonProps, "onClick">) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const [cooldown, setCooldown] = React.useState(0);
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: (res) => {
      toast.success(res?.message || t("resent"));
      setCooldown(COOLDOWN);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      disabled={!email || cooldown > 0 || props.disabled}
      loading={resend.isPending}
      onClick={() => resend.mutate()}
    >
      {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : (props.children ?? t("resend"))}
    </Button>
  );
}
