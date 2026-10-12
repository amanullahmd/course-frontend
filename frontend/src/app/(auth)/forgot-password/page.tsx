import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("forgotPassword") };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
