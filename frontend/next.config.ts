import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
