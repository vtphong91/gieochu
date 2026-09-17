import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Next.js only auto-loads .env files from this app's own directory; the
// monorepo keeps a single .env at the repo root (see packages/db/prisma.config.ts
// for the same pattern), so load it explicitly before anything reads process.env.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const securityHeaders = [
  // §7.8 CSP, X-Content-Type-Options, Referrer-Policy configured in next.config.
  // Kept permissive for M0 (marketing-only shell); tightened as modules that
  // need inline scripts/styles (payments QR, uploads) land.
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
