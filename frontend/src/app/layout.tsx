import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://course.amanullah.me").replace(/\/+$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  return {
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: "/" },
    title: { default: t("title"), template: "%s · Sprachweg" },
    description: t("description"),
    applicationName: "Sprachweg",
    openGraph: {
      type: "website",
      siteName: "Sprachweg",
      url: SITE_URL,
      title: t("title"),
      description: t("description"),
      locale: locale === "de" ? "de_DE" : "en_US",
    },
    twitter: { card: "summary", title: t("title"), description: t("description") },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <Providers locale={locale}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
