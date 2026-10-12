import type { CefrLevel } from "@/lib/api/types";

/**
 * Texts printed on the certificate itself. They follow the certificate's language (not the UI language) and mirror
 * the backend's `cert.*` keys in messages*.properties, so the live preview matches the PDF.
 */
export const CERTIFICATE_TEXTS = {
  en: {
    defaultTitle: "Certificate of Completion",
    lead: "This certifies that",
    afterName: "has successfully completed the course",
    afterCourse: "",
    level: (level: CefrLevel) => `Level ${level}`,
    cefr: "Common European Framework of Reference (CEFR)",
    score: (score: string) => `Final score ${score}`,
    date: "Date of completion",
    sealCaption: "CEFR level",
    signerRole: "Instructor",
    verifyLabel: "Verify this certificate",
    revoked: "REVOKED",
  },
  de: {
    defaultTitle: "Teilnahmebestätigung",
    lead: "Hiermit wird bestätigt, dass",
    afterName: "den Kurs",
    afterCourse: "erfolgreich abgeschlossen hat.",
    level: (level: CefrLevel) => `Niveau ${level}`,
    cefr: "Gemeinsamer Europäischer Referenzrahmen (GER)",
    score: (score: string) => `Gesamtergebnis ${score}`,
    date: "Abschlussdatum",
    sealCaption: "GER-Niveau",
    signerRole: "Kursleitung",
    verifyLabel: "Zertifikat prüfen",
    revoked: "WIDERRUFEN",
  },
} as const;

export type CertificateLang = keyof typeof CERTIFICATE_TEXTS;

export function formatCertificateDate(value: string | Date, lang: CertificateLang): string {
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-US", { dateStyle: "long", timeZone: "Europe/Berlin" }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatCertificateScore(value: number, lang: CertificateLang): string {
  const number = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return lang === "de" ? `${number.replace(".", ",")} %` : `${number}%`;
}

/** Same rule as CertificatePdfRenderer.density(): long texts get smaller type. */
export function certificateDensity(m: {
  title: string | null;
  learnerName: string;
  courseTitle: string;
  customText: string | null;
  lang: CertificateLang;
}): "" | "compact" | "dense" {
  const title = m.title?.trim().length ?? 0;
  const custom = m.customText?.trim().length ?? 0;
  const score =
    (custom > 160 ? 2 : custom > 0 ? 1 : 0) +
    (custom > 300 ? 1 : 0) +
    (m.courseTitle.length > 48 ? 1 : 0) +
    (m.courseTitle.length > 90 ? 1 : 0) +
    (m.learnerName.length > 30 ? 1 : 0) +
    (title > 40 ? 1 : 0) +
    (m.lang === "de" ? 1 : 0);
  return score >= 4 ? "dense" : score >= 3 ? "compact" : "";
}
