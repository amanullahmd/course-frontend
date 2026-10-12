"use client";

import * as React from "react";
import Link from "next/link";
import { Download, FileText, Scale, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError, setSession } from "@/lib/api/client";
import { privacyApi } from "@/lib/api/privacy";
import { useErrorMessage } from "@/hooks/use-error-message";
import type { UserDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fieldA11y } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { StorageUsageMeter } from "./storage-usage";

const CONFIRM_WORD = "DELETE";

function DeleteAccountDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: UserDto }) {
  const t = useTranslations("privacy.delete");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ready = password.length > 0 && confirm.trim() === CONFIRM_WORD;

  const reset = () => {
    setPassword("");
    setConfirm("");
    setPasswordError(null);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    setPasswordError(null);
    try {
      await privacyApi.deleteAccount({ password, confirm: confirm.trim() });
      queryClient.clear();
      setSession(null);
      window.location.replace("/goodbye");
    } catch (err) {
      if (isApiError(err) && err.code === "INVALID_PASSWORD") setPasswordError(t("wrongPassword"));
      else setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>{t("effectProfile")}</li>
            <li>{t("effectFiles")}</li>
            <li>{t("effectResults")}</li>
            {(user.role === "INSTRUCTOR" || user.role === "ADMIN") && <li>{t("effectCourses")}</li>}
          </ul>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive-soft/60 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Field label={t("password")} htmlFor="delete-password" error={passwordError ?? undefined}>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              {...fieldA11y("delete-password", passwordError ?? undefined)}
            />
          </Field>
          <Field label={t.rich("confirmLabel", { word: CONFIRM_WORD, b: (c) => <code className="font-mono font-semibold">{c}</code> })} htmlFor="delete-confirm">
            <Input
              id="delete-confirm"
              autoComplete="off"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_WORD}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready} loading={pending}>
              <Trash2 /> {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Settings → "Privacy & data": storage, data export (DSGVO Art. 15/20), account deletion (Art. 17), legal links. */
export function PrivacyCard({ user }: { user: UserDto }) {
  const t = useTranslations("privacy");
  const tl = useTranslations("legal");
  const errorMessage = useErrorMessage();
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const download = async () => {
    setExporting(true);
    try {
      await privacyApi.downloadExport();
      toast.success(t("export.done"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card id="privacy">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" /> {t("title")}
        </CardTitle>
        <CardDescription>{t("text")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <StorageUsageMeter />
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-sm font-medium">{t("export.title")}</p>
            <p className="text-sm text-muted-foreground">{t("export.text")}</p>
          </div>
          <Button variant="outline" onClick={() => void download()} loading={exporting} className="shrink-0">
            <Download /> {t("export.button")}
          </Button>
        </div>
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-destructive">{t("delete.cardTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("delete.cardText")}</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleting(true)} className="shrink-0">
            <Trash2 /> {t("delete.button")}
          </Button>
        </div>
        <nav aria-label={tl("navLabel")} className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-sm">
          <Link href="/datenschutz" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <ShieldCheck className="size-3.5" /> {tl("privacy")}
          </Link>
          <Link href="/agb" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Scale className="size-3.5" /> {tl("terms")}
          </Link>
          <Link href="/impressum" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <FileText className="size-3.5" /> {tl("imprint")}
          </Link>
        </nav>
      </CardContent>
      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} user={user} />
    </Card>
  );
}
