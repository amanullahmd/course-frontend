"use client";

import "./globals.css";

const COPY = {
  en: { title: "Something went wrong", text: "An unexpected error occurred. Please reload the page.", retry: "Try again", lang: "en" },
  de: { title: "Etwas ist schiefgelaufen", text: "Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.", retry: "Erneut versuchen", lang: "de" },
} as const;

function pickCopy() {
  if (typeof document !== "undefined" && document.cookie.split("; ").some((c) => c === "NEXT_LOCALE=de")) return COPY.de;
  return COPY.en;
}

/** Last-resort boundary that replaces the root layout (no providers available here). */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const copy = pickCopy();
  return (
    <html lang={copy.lang}>
      <body className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-foreground">
        <div role="alert" className="grid max-w-md gap-4 text-center">
          <h1 className="text-2xl font-semibold">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.text}</p>
          <button
            type="button"
            onClick={reset}
            className="mx-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
