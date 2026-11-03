import type { Metadata } from "next";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getEnv } from "@gieochu/config";
import { getEffectiveBrand } from "../../lib/branding";
import { SiteHeader } from "../_ui/site-header";
import { SiteFooter } from "../_ui/site-footer";
import { systemFontVars } from "../_ui/system-fonts";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getEffectiveBrand();
  const appUrl = getEnv().APP_URL.replace(/\/+$/, "");
  return {
    metadataBase: new URL(appUrl),
    title: `Giới thiệu ${brand.name} – Nền tảng chia sẻ và kết nối tri thức`,
    description: `${brand.name} là nền tảng giúp giáo viên, gia sư, coach và chuyên gia giới thiệu tài liệu số trong gian hàng mang dấu ấn riêng, đồng thời giúp người học tìm kiếm và quản lý học liệu thuận tiện.`,
    alternates: { canonical: `${appUrl}/gioi-thieu` },
  };
}

export default async function AboutPage() {
  const brand = await getEffectiveBrand();
  const BLUE = brandColors.primary;
  const BLUE_DEEP = brandColors.primaryDeep;
  const INK = brandColors.ink;
  const INK_SOFT = brandColors.inkSoft;
  const PAPER = brandColors.background;
  const LINE = brandColors.line;
  const AMBER = brandColors.accent;

  return (
    <div className={`${systemFontVars} min-h-dvh font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <SiteHeader />

      <main id="noi-dung" className="outline-none">
        {/* Hero Banner */}
        <section className="border-b py-12 sm:py-16 lg:py-20" style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #163660 100%)`, borderColor: LINE }}>
          <div className="container-page max-w-4xl text-center text-white">
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="hover:underline">Trang chủ</Link>
              <span>/</span>
              <span className="font-semibold text-white">Giới thiệu</span>
            </nav>
            <p className="mb-3 inline-block rounded-full border px-4 py-1 text-xs font-semibold sm:text-sm" style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)", color: brandColors.accentSoft }}>
              Về nền tảng {brand.name}
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl text-balance">
              Gieo kiến thức. Tạo giá trị bền vững.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-lg">
              {brand.name} được xây dựng với sứ mệnh kết nối những người có tri thức với những người đang khao khát học hỏi, tạo ra một không gian văn minh để chia sẻ và kinh doanh học liệu số.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="container-page max-w-3xl space-y-8">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold sm:text-3xl" style={{ color: BLUE }}>
                Gieo Chữ là ai?
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: INK_SOFT }}>
                Trong kỷ nguyên số, hàng triệu giáo viên, giảng viên, gia sư, coach và chuyên gia mỗi ngày đều dày công tích lũy kiến thức, soạn thảo giáo án, biên tập đề thi và sáng tạo tài nguyên học tập giá trị. Tuy nhiên, hành trình đưa những tài liệu đó đến với đúng người cần lại gặp nhiều trở ngại: tài liệu bị phân tán trên các hội nhóm, người sáng tạo không có kênh phân phối chuyên nghiệp, còn người học thì mất nhiều thời gian tìm kiếm mà không an tâm về chất lượng.
              </p>
              <p className="mt-3 text-base leading-relaxed" style={{ color: INK_SOFT }}>
                <strong>{brand.name}</strong> ra đời để xóa bỏ những rào cản đó. Chúng tôi cung cấp giải pháp công nghệ giúp người dạy học sở hữu gian hàng trực tuyến mang thương hiệu riêng chỉ trong vài phút, đồng thời mang đến cho người học một thư viện học liệu phong phú, đáng tin cậy và dễ dàng quản lý.
              </p>
            </div>

            {/* Hai đối tượng trọng tâm */}
            <div className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: LINE, background: "#FFFFFF" }}>
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold" style={{ color: INK }}>
                Hệ sinh thái kết nối hai phía
              </h3>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border p-5" style={{ borderColor: LINE, background: `color-mix(in srgb, ${BLUE} 4%, white)` }}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: BLUE }}>
                    Dành cho Người sáng tạo tri thức
                  </div>
                  <h4 className="font-semibold text-base" style={{ color: INK }}>Giáo viên, Gia sư, Coach & Chuyên gia</h4>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    <li>• Gian hàng riêng với tên miền và giao diện mang dấu ấn cá nhân.</li>
                    <li>• Studio quản lý sản phẩm, đơn hàng, khách hàng và doanh thu tập trung.</li>
                    <li>• Tự chủ phương thức nhận thanh toán (QR chuyển khoản, SePay, MoMo).</li>
                    <li>• Bảo vệ tài liệu và kiểm soát lượt chia sẻ/tải về.</li>
                  </ul>
                </div>

                <div className="rounded-2xl border p-5" style={{ borderColor: LINE, background: `color-mix(in srgb, ${brandColors.secondary} 4%, white)` }}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: brandColors.secondary }}>
                    Dành cho Người tìm kiếm học liệu
                  </div>
                  <h4 className="font-semibold text-base" style={{ color: INK }}>Người học, Giáo viên & Phụ huynh</h4>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    <li>• Khám phá hàng ngàn giáo án, bộ đề thi, slide bài giảng chất lượng.</li>
                    <li>• Xem trước nội dung (preview) trước khi đưa ra quyết định mua.</li>
                    <li>• Thanh toán nhanh chóng, an toàn và nhận tài liệu tức thì.</li>
                    <li>• Thư viện cá nhân lưu trữ vĩnh viễn, xem và tải lại mọi lúc.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Nguyên tắc cốt lõi */}
            <div>
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: INK }}>
                Cam kết và giá trị cốt lõi
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border p-4.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                  <h4 className="font-semibold text-sm" style={{ color: BLUE }}>1. Tôn trọng bản quyền</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                    Bảo vệ thành quả lao động trí tuệ của tác giả; kiên quyết xử lý hành vi sao chép trái phép.
                  </p>
                </div>
                <div className="rounded-2xl border p-4.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                  <h4 className="font-semibold text-sm" style={{ color: BLUE }}>2. Minh bạch & Thuận tiện</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                    Mọi giao dịch, trạng thái đơn và dòng tiền thanh toán đều rõ ràng, hỗ trợ tối đa cho người dùng.
                  </p>
                </div>
                <div className="rounded-2xl border p-4.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                  <h4 className="font-semibold text-sm" style={{ color: BLUE }}>3. Đồng hành bền vững</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
                    Cung cấp gói Miễn phí trọn đời để bất kỳ ai cũng có thể bắt đầu chia sẻ kiến thức ngay hôm nay.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Box */}
            <div className="rounded-3xl p-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${BLUE_DEEP} 0%, ${BLUE} 100%)` }}>
              <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
                Sẵn sàng đồng hành cùng {brand.name}?
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-white/80">
                Hãy mở gian hàng của bạn hoặc khám phá kho tàng học liệu hữu ích ngay hôm nay.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-sm font-bold shadow-md transition hover:brightness-105"
                  style={{ background: AMBER, color: "#241503" }}
                >
                  Bắt đầu tạo gian hàng
                </Link>
                <Link
                  href="/cua-hang/tai-lieu"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Khám phá tài liệu
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
