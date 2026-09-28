import { Be_Vietnam_Pro, Inter } from "next/font/google";

// Font hệ thống — Heading: Be Vietnam Pro, Body: Inter — theo
// docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md §30.
// Một nguồn duy nhất cho trang chủ + SiteHeader/SiteFooter (ADR-025): header/footer
// tự gắn class này nên vẫn đúng font hệ thống khi nằm trong trang có font riêng (storefront).
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

/** Class gắn biến `--font-heading`/`--font-body` hệ thống lên phần tử bọc. */
export const systemFontVars = `${beVietnamPro.variable} ${inter.variable}`;
