import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

/** Origin of the API (signed media URLs, fetch/XHR). Inlined at build time like NEXT_PUBLIC_API_URL itself. */
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").origin;
  } catch {
    return "http://localhost:8080";
  }
})();

/** Third-party players and documents that lessons may embed (see src/lib/embed.ts). */
const EMBED_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://player.vimeo.com",
  "https://docs.google.com",
  "https://drive.google.com",
  "https://*.h5p.com",
  "https://h5p.org",
  "https://learningapps.org",
];

/**
 * Content Security Policy. Next.js bootstraps the App Router with inline scripts and next-themes sets the theme
 * with an inline script, so scripts need 'unsafe-inline' (no nonces: pages are cached/static). Everything else is
 * restricted to this site, the API origin and the allowed embeds. Images may come from any https URL because lesson
 * bodies can contain pasted image links.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${API_ORIGIN}`,
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGIN}${isDev ? " ws: wss:" : ""}`,
  `media-src 'self' blob: ${API_ORIGIN}`,
  `frame-src 'self' ${API_ORIGIN} ${EMBED_ORIGINS.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(API_ORIGIN.startsWith("https:") && !isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Signed media URLs must never leak to embedded sites through the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) for the planned speaking exercises; everything else is off.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()",
  },
  // Only honoured over HTTPS (ignored on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Media is served through short-lived signed URLs from the API, so we
    // render it with plain <img> elements and never optimise it.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "api.course.amanullah.me" },
      { protocol: "http", hostname: "localhost", port: "8080" },
    ],
  },
  // Legal texts (content/legal/*.md) are read at request time; ship them with the standalone server.
  outputFileTracingIncludes: {
    "/impressum": ["./content/legal/**/*"],
    "/datenschutz": ["./content/legal/**/*"],
    "/agb": ["./content/legal/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
