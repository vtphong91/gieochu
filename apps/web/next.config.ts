import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Next.js only auto-loads .env files from this app's own directory; the
// monorepo keeps a single .env at the repo root (see packages/db/prisma.config.ts
// for the same pattern), so load it explicitly before anything reads process.env.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

// §7.8: Content-Security-Policy moved to proxy.ts — it needs a fresh nonce
// per request (Next's App Router injects its own inline <script> tags for
// RSC hydration on every render; a static CSP here can't include that
// nonce). Only the headers that don't vary per request stay here.
const securityHeaders = [
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
