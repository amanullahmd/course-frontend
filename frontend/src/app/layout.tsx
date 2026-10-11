import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://course.amanullah.me").replace(/\/+$/, "");
const DESCRIPTION =
  "Sprachweg is a course platform for German teachers and learners: build A1–C2 courses from any material, schedule releases, approve learners and track progress.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Sprachweg",
    url: SITE_URL,
    title: "Sprachweg: German courses, built your way",
    description: DESCRIPTION,
    locale: "en",
  },
  twitter: { card: "summary", title: "Sprachweg: German courses, built your way", description: DESCRIPTION },
  title: {
    default: "Sprachweg: German courses, built your way",
    template: "%s · Sprachweg",
  },
  description: DESCRIPTION,
  applicationName: "Sprachweg",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only z-[100] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
