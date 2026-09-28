import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { BrandMark } from "./brand-mark";
import { systemFontVars } from "./system-fonts";

const BLUE_DEEP = brandColors.primaryDeep;

/**
 * Footer hệ thống dùng chung mọi trang public (ADR-025). Chrome cố định, không thuộc CMS;
 * tự đọc brand/logo (cache() theo request) và tự gắn font hệ thống.
 * Nền full-bleed ở <footer>; nội dung bọc container-page (ADR-024).
 */
export async function SiteFooter() {
  const [brand, logos] = await Promise.all([getEffectiveBrand(), getEffectiveLogos()]);

  return (
    <footer
      className={`${systemFontVars} pt-12 pb-8 font-[family-name:var(--font-body)] sm:pt-16 lg:pt-[72px] lg:pb-10`}
      style={{ background: BLUE_DEEP }}
    >
      <div className="container-page flex flex-col gap-10 lg:gap-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="sm:w-[280px] lg:w-[320px]">
            <div className="mb-3.5 flex items-center gap-2.5">
              <BrandMark url={logos.logoFooterUrl} brandName={brand.name} size={40} rounded={9} fallbackBg="rgba(255,255,255,0.12)" />
              {logos.logoFooterUrl ? null : (
                <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">{brand.name}</span>
              )}
            </div>
            <p className="text-sm leading-[1.6] text-white/55">{brand.slogan}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Khám phá</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Tài liệu</span>
                <span>Giáo viên &amp; Coach</span>
                <Link href="/pricing">Bảng giá</Link>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Công ty</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Về {brand.name}</span>
                <span>Liên hệ</span>
                <span>Tuyển dụng</span>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Pháp lý</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Điều khoản dịch vụ</span>
                <span>Chính sách bảo mật</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-6 text-xs text-white/45 sm:pt-[26px]" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          © 2026 {brand.name}. Bảo lưu mọi quyền.
        </div>
      </div>
    </footer>
  );
}
