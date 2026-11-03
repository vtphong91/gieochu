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
    title: `Hướng dẫn sử dụng ${brand.name} – Dành cho Người bán & Người mua`,
    description: `Cẩm nang hướng dẫn chi tiết cách tạo gian hàng, đăng tải tài liệu, cấu hình thanh toán cho người bán và cách tìm kiếm, mua và tải tài liệu cho người mua trên ${brand.name}.`,
    alternates: { canonical: `${appUrl}/huong-dan-su-dung` },
  };
}

export default async function UserGuidePage() {
  const brand = await getEffectiveBrand();
  const BLUE = brandColors.primary;
  const BLUE_DEEP = brandColors.primaryDeep;
  const INK = brandColors.ink;
  const INK_SOFT = brandColors.inkSoft;
  const PAPER = brandColors.background;
  const LINE = brandColors.line;
  const AMBER = brandColors.accent;

  const SELLER_GUIDES = [
    {
      title: "1. Đăng ký tài khoản và kích hoạt gian hàng",
      desc: "Truy cập /register, điền email và mật khẩu. Sau khi đăng ký, hệ thống gửi email kích hoạt. Đăng nhập và tạo tên gian hàng (slug) mang thương hiệu của bạn.",
    },
    {
      title: "2. Cấu hình thương hiệu và giao diện Studio",
      desc: "Vào Studio > Cài đặt gian hàng để cập nhật ảnh đại diện (avatar), ảnh bìa (cover), thông tin giới thiệu, liên kết mạng xã hội và màu sắc chủ đạo.",
    },
    {
      title: "3. Đăng tải và quản lý tài liệu số",
      desc: "Vào Studio > Tài liệu > Thêm mới. Nhập tiêu đề, mô tả, chọn danh mục, tải tệp tài liệu chính (PDF, Word, Excel, Slide...). Hệ thống hỗ trợ trích xuất bản xem trước (preview) tự động để khách hàng duyệt thử.",
    },
    {
      title: "4. Thiết lập phương thức nhận thanh toán",
      desc: "Vào Studio > Cài đặt > Thanh toán. Nhập thông tin số tài khoản ngân hàng để tạo mã VietQR tự động, hoặc tích hợp SePay / MoMo để nhận tiền trực tiếp từ người mua.",
    },
    {
      title: "5. Xử lý đơn hàng và xác nhận thanh toán",
      desc: "Với đơn chuyển khoản ngân hàng thủ công, người bán kiểm tra sao kê tài khoản và nhấn 'Xác nhận đã thanh toán' trong Studio > Đơn hàng để hệ thống gửi quyền tải file cho khách.",
    },
  ];

  const BUYER_GUIDES = [
    {
      title: "1. Tìm kiếm và chọn lọc học liệu",
      desc: "Tìm tài liệu trên thanh tìm kiếm hoặc khám phá theo danh mục tại Cửa hàng (/cua-hang). Bạn có thể tìm theo tên tài liệu, môn học, giáo viên hoặc cấp lớp.",
    },
    {
      title: "2. Xem thông tin chi tiết và bản xem trước",
      desc: "Bấm vào tài liệu để xem nội dung tóm tắt, mục lục, thông tin tác giả và bản xem trước (preview) các trang mẫu trước khi quyết định mua.",
    },
    {
      title: "3. Đặt mua và thanh toán an toàn",
      desc: "Bấm 'Mua ngay'. Nếu chưa có tài khoản, bạn chỉ cần nhập họ tên và email nhận tài liệu. Thực hiện quét mã VietQR ngân hàng hoặc ví MoMo theo đúng số tiền và nội dung chuyển khoản được cấp.",
    },
    {
      title: "4. Nhận tài liệu và tải về thư viện",
      desc: "Ngay sau khi đơn hàng được xác nhận thanh toán, link tải tài liệu sẽ được gửi về email của bạn. Đồng thời, tài liệu sẽ được lưu vĩnh viễn trong mục 'Thư viện của tôi' (/account/library).",
    },
    {
      title: "5. Hỗ trợ và giải quyết sự cố",
      desc: "Nếu gặp vấn đề khi tải file hoặc cần liên hệ tác giả, bạn có thể gửi yêu cầu hỗ trợ qua form liên hệ của gian hàng hoặc liên hệ ban quản trị Gieo Chữ qua trang /lien-he.",
    },
  ];

  return (
    <div className={`${systemFontVars} min-h-dvh font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <SiteHeader />

      <main id="noi-dung" className="outline-none">
        {/* Hero Section */}
        <section className="border-b py-12 sm:py-16" style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #163660 100%)`, borderColor: LINE }}>
          <div className="container-page max-w-4xl text-center text-white">
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="hover:underline">Trang chủ</Link>
              <span>/</span>
              <span className="font-semibold text-white">Hướng dẫn sử dụng</span>
            </nav>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight sm:text-4xl text-balance">
              Trung tâm Hướng dẫn sử dụng {brand.name}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-base">
              Cẩm nang từng bước giúp bạn dễ dàng làm quen và khai thác tối đa các tiện ích trên nền tảng.
            </p>
          </div>
        </section>

        {/* Nội dung hướng dẫn */}
        <section className="py-12 sm:py-16">
          <div className="container-page max-w-4xl space-y-12">
            {/* Dành cho Người bán */}
            <div id="nguoi-ban">
              <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: LINE }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white" style={{ background: BLUE }}>
                  ★
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                    Dành cho Người bán (Studio)
                  </h2>
                  <p className="text-sm text-gray-500">Hướng dẫn xây dựng gian hàng, đăng tài liệu và quản lý đơn</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {SELLER_GUIDES.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" style={{ borderColor: LINE }}>
                    <h3 className="font-semibold text-base sm:text-lg" style={{ color: INK }}>
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dành cho Người mua */}
            <div id="nguoi-mua">
              <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: LINE }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl font-bold text-white" style={{ background: brandColors.secondary }}>
                  ♥
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: brandColors.secondary }}>
                    Dành cho Người mua (Customer)
                  </h2>
                  <p className="text-sm text-gray-500">Hướng dẫn khám phá, mua học liệu và quản lý thư viện cá nhân</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {BUYER_GUIDES.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" style={{ borderColor: LINE }}>
                    <h3 className="font-semibold text-base sm:text-lg" style={{ color: INK }}>
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trợ giúp thêm */}
            <div className="rounded-2xl border p-6 text-center sm:p-8" style={{ borderColor: LINE, background: "#FFFFFF" }}>
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
                Bạn vẫn cần thêm sự trợ giúp?
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Đội ngũ hỗ trợ {brand.name} luôn sẵn sàng giải đáp mọi thắc mắc của bạn.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/lien-he"
                  className="inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                  style={{ background: BLUE }}
                >
                  Liên hệ hỗ trợ
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold transition hover:bg-gray-50"
                  style={{ borderColor: LINE, color: INK }}
                >
                  Xem Bảng giá
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
