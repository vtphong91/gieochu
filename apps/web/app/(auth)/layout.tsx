import type { ReactNode } from "react";
import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { BrandMark } from "../_ui/brand-mark";
import { BLUE, BLUE_DEEP, INK, PAPER } from "./_ui/colors";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const TRUST_POINTS = [
  "Trang bán hàng riêng, thương hiệu riêng cho từng giáo viên/coach",
  "Thanh toán qua VietQR, MoMo — tiền về thẳng tài khoản của bạn",
  "Khách hàng có 1 tài khoản duy nhất cho mọi tài liệu đã mua",
];

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [brand, logos] = await Promise.all([getEffectiveBrand(), getEffectiveLogos()]);

  return (
    <div
      className={`${beVietnamPro.variable} ${inter.variable} grid min-h-dvh font-[family-name:var(--font-body)] lg:grid-cols-2`}
      style={{ background: PAPER, color: INK }}
    >
      <aside
        className="hidden flex-col justify-between p-10 text-white lg:flex"
        style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DEEP} 100%)` }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark url={logos.logoDarkUrl} brandName={brand.name} size={46} fallbackBg="rgba(255,255,255,0.15)" />
          {logos.logoDarkUrl ? null : (
            <span className="font-[family-name:var(--font-heading)] text-lg font-semibold">{brand.name}</span>
          )}
        </Link>

        <div className="max-w-sm">
          <p className="font-[family-name:var(--font-heading)] text-3xl leading-snug font-semibold">{brand.slogan}</p>
          <ul className="mt-8 space-y-4 text-sm text-white/85">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <IconCheck className="h-3 w-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </aside>

      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-6 lg:py-16">
        <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <BrandMark url={logos.logoLightUrl} brandName={brand.name} size={42} rounded={9} fallbackBg={BLUE} />
          {logos.logoLightUrl ? null : (
            <span className="font-[family-name:var(--font-heading)] text-base font-semibold">{brand.name}</span>
          )}
        </Link>
        {children}
      </div>
    </div>
  );
}
