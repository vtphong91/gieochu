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
    title: `Chính sách thanh toán và hoàn tiền | ${brand.name}`,
    description: `Quy định chi tiết về phương thức thanh toán, luồng tiền và quy trình xử lý khiếu nại, hoàn tiền trên nền tảng ${brand.name}.`,
    alternates: { canonical: `${appUrl}/chinh-sach-thanh-toan-hoan-tien` },
  };
}

export default async function PaymentRefundPolicyPage() {
  const brand = await getEffectiveBrand();
  const BLUE = brandColors.primary;
  const BLUE_DEEP = brandColors.primaryDeep;
  const INK = brandColors.ink;
  const INK_SOFT = brandColors.inkSoft;
  const PAPER = brandColors.background;
  const LINE = brandColors.line;

  return (
    <div className={`${systemFontVars} min-h-dvh font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <SiteHeader />

      <main id="noi-dung" className="outline-none">
        {/* Header Banner */}
        <section className="border-b py-10 sm:py-14" style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #163660 100%)`, borderColor: LINE }}>
          <div className="container-page max-w-4xl text-center text-white">
            <nav aria-label="Breadcrumb" className="mb-3 flex items-center justify-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="hover:underline">Trang chủ</Link>
              <span>/</span>
              <span className="font-semibold text-white">Chính sách thanh toán & hoàn tiền</span>
            </nav>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl text-balance">
              Chính sách Thanh toán và Hoàn tiền
            </h1>
            <p className="mx-auto mt-2 text-xs text-white/70 sm:text-sm">
              Áp dụng cho mọi giao dịch trên nền tảng {brand.name} • Cập nhật lần cuối: Tháng 11/2026
            </p>
          </div>
        </section>

        {/* Nội dung chính sách */}
        <section className="py-12 sm:py-16">
          <div className="container-page max-w-3xl space-y-10 text-[15px] leading-relaxed" style={{ color: INK_SOFT }}>
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                1. Phân định hai phạm vi giao dịch
              </h2>
              <p className="mt-3">
                Nhằm đảm bảo sự minh bạch và bảo vệ quyền lợi của tất cả các bên tham gia, hệ thống phân biệt rõ ràng hai phạm vi thanh toán độc lập:
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border p-4.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                  <p className="font-semibold" style={{ color: INK }}>
                    Phạm vi A: Phí gói dịch vụ của Người bán (Subscription / Platform Fee)
                  </p>
                  <p className="mt-1 text-sm">
                    Khoản phí mà chủ gian hàng thanh toán trực tiếp cho đơn vị vận hành {brand.name} để duy trì hoặc nâng cấp các gói tài nguyên Studio (Creator, Pro, Business). Phí này thanh toán theo chu kỳ tháng hoặc năm theo quy định tại trang <Link href="/pricing" className="text-blue-600 underline">Bảng giá</Link>.
                  </p>
                </div>
                <div className="rounded-xl border p-4.5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                  <p className="font-semibold" style={{ color: INK }}>
                    Phạm vi B: Khoản thanh toán mua tài liệu số của Người mua (Storefront Order)
                  </p>
                  <p className="mt-1 text-sm">
                    Khoản tiền người mua chi trả để sở hữu quyền tải và sử dụng tài liệu từ gian hàng của người bán. Số tiền này được chuyển trực tiếp vào tài khoản ngân hàng hoặc ví điện tử do chính người bán thiết lập trên gian hàng của họ.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                2. Phương thức thanh toán được hỗ trợ
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Chuyển khoản liên ngân hàng qua VietQR:</strong> Người mua quét mã QR chuẩn NAPAS bằng ứng dụng ngân hàng. Hệ thống tự động điền số tài khoản, số tiền và mã đơn hàng duy nhất.
                </li>
                <li>
                  <strong>Ví điện tử MoMo:</strong> Chuyển tiền qua ví MoMo theo thông tin số điện thoại và nội dung mã đơn hàng do người bán cung cấp.
                </li>
                <li>
                  <strong>Cổng thanh toán tự động (SePay):</strong> Với gian hàng đã tích hợp SePay, giao dịch được tự động quét và kích hoạt cấp quyền tải tài liệu ngay sau 1-3 phút.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                3. Quy trình xác nhận đơn và cấp quyền truy cập
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Xác nhận tự động:</strong> Áp dụng cho các đơn thanh toán qua cổng tự động. Sau khi hệ thống đối soát trùng khớp mã đơn và số tiền, tài liệu sẽ hiển thị ngay trong thư viện của người mua và email xác nhận được gửi đi tức thì.
                </li>
                <li>
                  <strong>Xác nhận thủ công:</strong> Áp dụng cho chuyển khoản QR thông thường. Người mua chuyển tiền và có thể nhấn “Tôi đã chuyển tiền”. Người bán kiểm tra thông báo tài khoản và nhấn xác nhận trong Studio để cấp quyền cho khách.
                </li>
                <li>
                  <strong>Thời hạn giữ đơn:</strong> Đơn hàng chưa thanh toán sẽ có hiệu lực trong vòng 48 giờ. Quá thời gian này, đơn sẽ tự động hủy nếu chưa nhận được thanh toán.
                </li>
              </ul>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                4. Chính sách hoàn tiền đối với tài liệu số
              </h2>
              <p className="mt-3">
                Do đặc thù hàng hóa là sản phẩm số (digital goods) có thể tải về và sao chép ngay sau khi thanh toán, {brand.name} <strong>không hỗ trợ chính sách trả hàng / hoàn tiền tự động vô điều kiện</strong>.
              </p>
              <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: LINE, background: "#FFFFFF" }}>
                <p className="font-semibold" style={{ color: INK }}>Các trường hợp được xem xét giải quyết hoàn tiền:</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                  <li>Tệp tài liệu bị lỗi kỹ thuật, hỏng dữ liệu không thể mở hoặc đọc được và người bán không cung cấp được tệp sửa đổi thay thế trong vòng 48 giờ.</li>
                  <li>Tài liệu bị khiếu nại vi phạm bản quyền nghiêm trọng và đã bị gỡ bỏ khỏi hệ thống.</li>
                  <li>Người mua vô tình chuyển trùng lặp hai lần thanh toán cho cùng một mã đơn hàng.</li>
                  <li>Nội dung tài liệu khác biệt hoàn toàn hoặc sai lệch nghiêm trọng so với tiêu đề, mô tả và bản xem trước được cung cấp.</li>
                </ul>
              </div>
            </div>

            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold sm:text-2xl" style={{ color: BLUE }}>
                5. Quy trình tiếp nhận và xử lý yêu cầu hoàn tiền
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>
                  <strong>Bước 1 (Liên hệ Người bán):</strong> Người mua gửi tin nhắn qua biểu mẫu liên hệ của gian hàng hoặc email của người bán được ghi trên hoá đơn điện tử để thoả thuận hoàn tiền.
                </li>
                <li>
                  <strong>Bước 2 (Khiếu nại tới Nền tảng):</strong> Trong trường hợp người bán không phản hồi sau 3 ngày làm việc hoặc hai bên không đạt được thỏa thuận, người mua gửi khiếu nại tới <Link href="/lien-he" className="text-blue-600 underline">bộ phận hỗ trợ Gieo Chữ</Link> kèm mã đơn hàng và bằng chứng chuyển tiền.
                </li>
                <li>
                  <strong>Bước 3 (Xử lý & Hoàn tất):</strong> Ban quản trị sẽ rà soát nội dung tài liệu, liên hệ người bán và ra quyết định. Trường hợp được duyệt hoàn tiền, số tiền sẽ được chuyển trả vào tài khoản ngân hàng của người mua trong 3-5 ngày làm việc.
                </li>
              </ol>
            </div>

            <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: LINE, background: `color-mix(in srgb, ${BLUE} 4%, white)` }}>
              <p className="font-semibold" style={{ color: INK }}>Cần hỗ trợ về thanh toán hoặc đơn hàng?</p>
              <p className="mt-1">
                Vui lòng gửi email tới bộ phận chăm sóc khách hàng hoặc truy cập trang <Link href="/lien-he" className="font-medium text-blue-700 underline">Liên hệ và Hỗ trợ</Link> để được giải đáp nhanh chóng nhất.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
