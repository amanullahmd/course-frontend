import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LearnerCertificateView } from "@/components/certificates/learner-certificate-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("certificates"))("metaTitle") };
}

export default function LearnCertificatePage() {
  return <LearnerCertificateView />;
}
