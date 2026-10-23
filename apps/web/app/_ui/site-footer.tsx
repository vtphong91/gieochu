import { brandColors } from "@gieochu/config/theme";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { getSiteMenu } from "../../lib/site-menu";
import { BrandMark } from "./brand-mark";
import { NavLinkAnchor } from "./nav-link";
import { systemFontVars } from "./system-fonts";

const BLUE_DEEP = brandColors.primaryDeep;

/**
 * Link footer: chữ trắng 70% (≥ 4.5:1 trên nền primaryDeep), hover/focus sáng hẳn + gạch chân + focus ring trắng. Cao 44px
 * dưới `lg` (vùng chạm), gọn lại từ `lg`.
 */
const FOOTER_LINK =
  "inline-flex min-h-11 w-fit max-w-full items-center gap-1.5 rounded-sm outline-offset-2 hover:text-white hover:underline focus-visible:text-white focus-visible:outline-2 focus-visible:outline-white lg:min-h-0 lg:py-0.5";

/**
 * Lưới cột link theo số cột CMS (1–4, ADR-050). Mobile: 1 cột khi chỉ có 1, còn lại 2 cột; `sm`: đủ cột (≤ 4); `lg`: cột
 * rộng tối đa ~200px, dồn sang phải cạnh khối thương hiệu. Class viết tĩnh để Tailwind sinh được.
 */
const COLUMN_GRID: Record<number, string> = {
  1: "grid-cols-1 lg:grid-cols-[minmax(0,240px)]",
  2: "grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,220px))]",
  3: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,200px))]",
  4: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,180px))]",
};

/**
 * Footer hệ thống dùng chung mọi trang public (ADR-025). Bố cục cố định; mô tả, cột link và dòng bản quyền
 * đọc từ CMS menu (ADR-050, `getSiteMenu` — năm bản quyền theo giờ VN, không gõ cứng);
 * tự đọc brand/logo (cache() theo request) và tự gắn font hệ thống.
 * Nền full-bleed ở <footer>; nội dung bọc container-page (ADR-024). Mỗi cột = tiêu đề H2 (cỡ chữ nhỏ) + danh sách link,
 * cả khối nằm trong `<nav aria-label="Liên kết chân trang">`. Link ngoài/tab mới có chỉ báo (`NavLinkLabel`).
 */
export async function SiteFooter() {
  const [brand, logos, menu] = await Promise.all([getEffectiveBrand(), getEffectiveLogos(), getSiteMenu()]);
  const columns = menu.footer.columns;
  const gridClass = COLUMN_GRID[Math.min(Math.max(columns.length, 1), 4)];

  return (
    <footer
      className={`site-footer ${systemFontVars} pt-12 pb-8 font-[family-name:var(--font-body)] sm:pt-16 lg:pt-[72px] lg:pb-10`}
      style={{ background: BLUE_DEEP }}
    >
      <div className="container-page flex flex-col gap-10 lg:gap-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="lg:w-[320px] lg:shrink-0">
            <div className="mb-3.5 flex items-center gap-2.5">
              <BrandMark url={logos.logoFooterUrl} brandName={brand.name} size={40} rounded={9} fallbackBg="rgba(255,255,255,0.12)" />
              {logos.logoFooterUrl ? null : (
                <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">{brand.name}</span>
              )}
            </div>
            {menu.footer.description ? <p className="text-sm leading-[1.6] text-white/65 sm:max-w-[28rem]">{menu.footer.description}</p> : null}
          </div>
          {columns.length > 0 ? (
            <nav aria-label="Liên kết chân trang" className="min-w-0 lg:flex-1">
              <div className={`grid gap-x-8 gap-y-8 lg:justify-end lg:gap-x-12 ${gridClass}`}>
                {columns.map((column) => (
                  <div key={column.id} className="min-w-0">
                    <h2 className="mb-2 text-[13px] font-bold tracking-wide text-white sm:text-[13.5px] lg:mb-4 [overflow-wrap:anywhere]">{column.title}</h2>
                    <ul className="flex flex-col text-sm text-white/70 lg:gap-2.5">
                      {column.links.map((link) => (
                        <li key={link.id}>
                          <NavLinkAnchor link={link} className={FOOTER_LINK} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>
          ) : null}
        </div>
        <p className="border-t pt-6 text-xs text-white/65 sm:pt-[26px]" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          {menu.footer.copyright}
        </p>
      </div>
    </footer>
  );
}
