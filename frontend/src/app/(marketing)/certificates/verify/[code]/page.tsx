import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifyCertificateView } from "@/components/certificates/verify-certificate-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("certificates.verify");
  return { title: t("metaTitle"), description: t("metaDescription"), robots: { index: false, follow: false } };
}

/** Public verification page (linked from the certificate's QR code). The lookup runs in the browser. */
export default async function VerifyCertificatePage({ params }: PageProps<"/certificates/verify/[code]">) {
  const { code } = await params;
  return <VerifyCertificateView code={decodeURIComponent(code)} />;
}
