import type { Metadata } from "next";
import { getEffectiveBrand, getEffectiveBrandColors, getEffectiveLogos } from "../lib/branding";
import { darkenHex, lightenHex } from "../lib/color-utils";
import { getSessionPolicy } from "../lib/jwt-context";
import { getSessionClientInfo } from "../lib/session";
import { SessionRefresh } from "./_ui/session-refresh";
import "./globals.css";

// Root layout đọc SystemBranding từ DB (lib/branding.ts) cho mọi trang, kể cả
// /_not-found. Ép render động để `next build` không prerender → không kết nối
// DB và không gọi getEnv() lúc build (env vẫn fail-fast ở runtime). CSP nonce
// sinh theo request trong proxy.ts (ADR-016) cũng chỉ gắn được vào trang render
// động. Áp cho mọi page/layout con; route handler (route.ts) cấu hình riêng.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [brand, logos] = await Promise.all([getEffectiveBrand(), getEffectiveLogos()]);
  return {
    title: brand.name,
    description: brand.slogan,
    icons: logos.faviconUrl ? { icon: logos.faviconUrl } : undefined,
    openGraph: logos.ogImageUrl ? { images: [{ url: logos.ogImageUrl, width: 1200, height: 630 }] } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [colors, session] = await Promise.all([getEffectiveBrandColors(), getSessionClientInfo()]);
  // ADR-053: chính sách phiên của người đang xem (khách → mức mặc định, chỉ để tính chu kỳ; không có cảnh báo idle).
  const policy = await getSessionPolicy(session?.role ?? "USER", session?.rememberMe ?? false);
  // System Admin chỉ chọn 3 màu gốc (primary/accent/secondary) ở
  // /admin/settings/branding — 2 sắc dẫn xuất (đậm hơn cho gradient/hover,
  // nhạt hơn cho nền badge) tính tự động từ đó, không cần chọn thêm.
  const primaryDeep = darkenHex(colors.primary, 0.45);
  const accentSoft = lightenHex(colors.accent, 0.12);

  const cssVars = `:root{--brand-primary:${colors.primary};--brand-primary-deep:${primaryDeep};--brand-accent:${colors.accent};--brand-accent-soft:${accentSoft};--brand-secondary:${colors.secondary};}`;

  return (
    <html lang="vi">
      <head>
        <style>{cssVars}</style>
      </head>
      <body>
        {/* ADR-053: `signedIn` = trạng thái UI lúc render — SessionRefresh so với kết quả refresh để đồng bộ lại UI. */}
        <SessionRefresh
          accessTokenTtlSeconds={policy.accessTtlSeconds}
          idleSeconds={session && policy.idleMs !== null ? Math.floor(policy.idleMs / 1000) : null}
          warningSeconds={session && policy.warningMs !== null ? Math.floor(policy.warningMs / 1000) : null}
          sessionIssuedAtMs={session?.issuedAtMs ?? null}
          signedIn={session !== null}
        />
        {children}
      </body>
    </html>
  );
}
