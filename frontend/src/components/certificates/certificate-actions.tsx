"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { downloadCertificatePdf, linkedInAddUrl, verifyPath, type CertificateDto } from "@/lib/api/certificates";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Button } from "@/components/ui/button";
import { CERTIFICATE_TEXTS } from "./certificate-texts";

/** Downloads a certificate PDF with the access token and reports errors as toasts. */
export function useCertificateDownload(scope: "student" | "instructor" = "student") {
  const t = useTranslations("certificates");
  const errorMessage = useErrorMessage();
  const [pending, setPending] = React.useState<string | null>(null);
  const download = React.useCallback(
    async (id: string) => {
      setPending(id);
      try {
        const name = await downloadCertificatePdf(id, scope);
        toast.success(t("downloaded", { name }));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setPending(null);
      }
    },
    [scope, t, errorMessage],
  );
  return { download, pending };
}

export function useCopyLink() {
  const t = useTranslations("certificates");
  return React.useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t("linkCopied"));
      } catch {
        toast.error(t("copyFailed"));
      }
    },
    [t],
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Download PDF · copy verification link · add to LinkedIn · open the public verification page. */
export function CertificateActions({ certificate, size = "default" }: { certificate: CertificateDto; size?: "default" | "sm" }) {
  const t = useTranslations("certificates");
  const { download, pending } = useCertificateDownload();
  const copy = useCopyLink();
  const lang = certificate.language === "de" ? "de" : "en";
  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} onClick={() => download(certificate.id)} disabled={pending === certificate.id}>
        <Download /> {pending === certificate.id ? t("downloading") : t("downloadPdf")}
      </Button>
      <Button size={size} variant="outline" onClick={() => copy(certificate.verificationUrl)}>
        <Copy /> {t("copyLink")}
      </Button>
      <Button size={size} variant="outline" asChild>
        <a href={linkedInAddUrl(certificate, CERTIFICATE_TEXTS[lang].defaultTitle)} target="_blank" rel="noopener noreferrer">
          <LinkedInIcon /> {t("shareLinkedIn")}
        </a>
      </Button>
      <Button size={size} variant="ghost" asChild>
        <Link href={verifyPath(certificate.code)} target="_blank">
          <ShieldCheck /> {t("verifyPage")} <ExternalLink className="opacity-60" />
        </Link>
      </Button>
    </div>
  );
}
