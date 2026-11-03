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
    title: `Dành cho người bán tài liệu số | ${brand.name} Studio`,
    description: `Mở gian hàng trực tuyến mang thương hiệu riêng, xuất bản học liệu và kinh doanh tài liệu số dễ dàng với ${brand.name} Studio. Bắt đầu miễn phí.`,
    alternates: { canonical: `${appUrl}/danh-cho-nguoi-ban` },
  };
}

export default async function ForSellersPage() {
  const brand = await getEffectiveBrand();
  const BLUE = brandColors.primary;
  const BLUE_DEEP = brandColors.primaryDeep;
  const INK = brandColors.ink;
  const INK_SOFT = brandColors.inkSoft;
  const PAPER = brandColors.background;
  const LINE = brandColors.line;
  const AMBER = brandColors.accent;

  const STEPS = [
    {
      num: "01",
      title: "Đăng ký & Mở gian hàng",
      desc: "Tạo tài khoản và chọn địa chỉ đường dẫn gian hàng mang thương hiệu của bạn chỉ trong 60 giây.",
    },
    {
      num: "02",
      title: "Cấu hình nhận thanh toán",
      desc: "Thiết lập tài khoản ngân hàng nhận tiền trực tiếp qua VietQR, MoMo hoặc SePay. Tiền về thẳng tài khoản của bạn.",
    },
    {
      num: "03",
      title: "Đăng tải tài liệu",
      desc: "Tải lên tệp tài liệu số (PDF, DOCX, Slide, Ebook...). Hệ thống tự trích xuất bản xem trước (preview) an toàn.",
    },
    {
      num: "04",
      title: "Chia sẻ & Tăng doanh thu",
      desc: "Gửi link gian hàng cho học viên, cộng đồng và mạng xã hội. Theo dõi đơn hàng và doanh số tự động qua Studio.",
    },
  ];

  const BENEFITS = [
    {
      title: "Gian hàng mang thương hiệu riêng",
      desc: "Trang công khai với logo, ảnh bìa, màu sắc nhận diện và phần giới thiệu bản thân chuyên nghiệp.",
    },
    {
      title: "Bộ công cụ Studio quản lý tập trung",
      desc: "Quản lý toàn bộ danh mục tài liệu, đơn hàng, khách hàng và lịch sử giao dịch trên một bảng điều khiển.",
    },
    {
      title: "Bảo vệ tài liệu & Trích xuất xem trước",
      desc: "Hỗ trợ trích xuất trang mẫu tự động, chia sẻ link có mật khẩu hoặc giới hạn số lượt tải về.",
    },
    {
      title: "Tự chủ thanh toán & Không đọng vốn",
      desc: "Khách chuyển khoản trực tiếp vào tài khoản ngân hàng của bạn theo cấu hình gian hàng.",
    },
    {
      title: "Bắt đầu với Gói Miễn phí trọn đời",
      desc: "Mọi gian hàng mới đều có thể bắt đầu bán ngay với gói Free mà không phải chịu chi phí duy trì bắt buộc.",
    },
    {
      title: "Xuất hiện trên Cửa hàng Gieo Chữ",
      desc: "Tài liệu công khai có cơ hội tiếp cận hàng chục ngàn học viên, phụ huynh đang tìm kiếm học liệu trên hệ thống.",
    },
  ];

  return (
    <div className={`${systemFontVars} min-h-dvh font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <SiteHeader />

      <main id="noi-dung" className="outline-none">
        {/* Hero Section */}
        <section className="border-b py-12 sm:py-16 lg:py-20" style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #163660 100%)`, borderColor: LINE }}>
          <div className="container-page max-w-4xl text-center text-white">
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="hover:underline">Trang chủ</Link>
              <span>/</span>
              <span className="font-semibold text-white">Dành cho người bán</span>
            </nav>
            <p className="mb-3 inline-block rounded-full border px-4 py-1 text-xs font-semibold sm:text-sm" style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)", color: brandColors.accentSoft }}>
              {brand.name} Studio
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl text-balance">
              Biến kiến thức của bạn thành gian hàng số & giá trị bền vững
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-lg">
              Giải pháp toàn diện giúp giáo viên, gia sư, coach và chuyên gia xuất bản, phân phối tài liệu học tập dễ dàng mà không cần biết lập trình website.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3 text-base font-bold shadow-lg transition hover:brightness-105"
                style={{ background: AMBER, color: "#241503" }}
              >
                Mở gian hàng miễn phí
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Xem các gói dịch vụ
              </Link>
            </div>
          </div>
        </section>

        {/* Lợi ích */}
        <section className="py-14 sm:py-20">
          <div className="container-page max-w-5xl">
            <div className="text-center">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold sm:text-3xl" style={{ color: BLUE }}>
                Tại sao chọn {brand.name} Studio?
              </h2>
              <p className="mt-2 text-base" style={{ color: INK_SOFT }}>
                Chúng tôi lo toàn bộ công nghệ, bạn chỉ cần tập trung vào chuyên môn và tài liệu của mình.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((item, idx) => (
                <div key={idx} className="flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md" style={{ borderColor: LINE }}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl font-bold" style={{ background: `color-mix(in srgb, ${BLUE} 10%, white)`, color: BLUE }}>
                    ✓
                  </div>
                  <h3 className="font-semibold text-base leading-snug" style={{ color: INK }}>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quy trình bắt đầu */}
        <section className="py-14 sm:py-20" style={{ background: `color-mix(in srgb, ${BLUE} 3%, white)` }}>
          <div className="container-page max-w-4xl">
            <div className="text-center">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold sm:text-3xl" style={{ color: INK }}>
                Cách bắt đầu cùng {brand.name}
              </h2>
              <p className="mt-2 text-base" style={{ color: INK_SOFT }}>
                Chỉ 4 bước đơn giản từ tài liệu bạn đang có đến gian hàng đầu tiên.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {STEPS.map((step, idx) => (
                <div key={idx} className="flex items-start gap-4 rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: LINE }}>
                  <span className="font-[family-name:var(--font-heading)] text-3xl font-black" style={{ color: AMBER }}>
                    {step.num}
                  </span>
                  <div>
                    <h3 className="font-semibold text-base" style={{ color: INK }}>
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-full px-8 py-3 text-base font-bold text-white shadow-md transition hover:brightness-105"
                style={{ background: BLUE }}
              >
                Tạo gian hàng ngay
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
