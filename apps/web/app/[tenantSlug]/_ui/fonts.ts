import { Inter, Montserrat } from "next/font/google";

// Storefront bám ảnh mẫu portfolio: heading Montserrat (font của mẫu, có subset
// vietnamese — dấu hiển thị đầy đủ), body Inter như toàn sản phẩm. Chỉ áp dụng
// trong `.sf-root` của /[tenantSlug]; System Center/Studio vẫn dùng Be Vietnam Pro.
export const headingFont = Montserrat({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
});

export const bodyFont = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});
