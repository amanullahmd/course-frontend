"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { Button, type ButtonProps } from "@/components/ui/button";

const COOLDOWN = 30;

export function ResendVerificationButton({ email, ...props }: { email: string } & Omit<ButtonProps, "onClick">) {
  const [cooldown, setCooldown] = React.useState(0);
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: (res) => {
      toast.success(res?.message || "Verification e-mail sent. Check your inbox.");
      setCooldown(COOLDOWN);
    },
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
      {cooldown > 0 ? `Resend in ${cooldown}s` : (props.children ?? "Resend verification e-mail")}
    </Button>
  );
}
