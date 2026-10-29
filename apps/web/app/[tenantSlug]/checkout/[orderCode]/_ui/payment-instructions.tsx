import Link from "next/link";
import type { CheckoutView } from "../../../../../lib/checkout-view";
import { IconExternalLink } from "../../../../admin/_ui/icons";
import { IconInfo } from "../../../../[tenantSlug]/_ui/icons";
import { TransferDetails } from "../../../../_ui/transfer-details";
import { bankTransferRows, walletTransferRows } from "../../../../_ui/transfer-rows";
import { CautionNote, FOCUS, PAYMENT_HEADING_ID } from "./checkout-parts";
import { formatVnd } from "./format";

/**
 * Khối thanh toán theo phương thức (ADR-062 §4.4): h2 → câu dẫn → QR (224px, trước) → tên ngân hàng → "Số tiền cần chuyển" →
 * "Tải ảnh QR" → các dòng sao chép (nội dung CK đầu tiên) → khối lưu ý. Số tiền luôn lấy từ đơn (server đã tính lại).
 * `headingLevel` = 3 khi nằm trong `<details>` "Xem lại thông tin chuyển khoản" (dưới h2 của khối chờ xác nhận).
 */
export function PaymentInstructions({ view, headingLevel = 2 }: { view: CheckoutView; headingLevel?: 2 | 3 }) {
  const { order, bank, links } = view;
  const checkout = order.checkout;
  if (!checkout) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingClass = `font-[family-name:var(--font-heading)] font-bold outline-none ${headingLevel === 2 ? "text-xl" : "text-base"}`;
  const manual = order.confirmMode === "MANUAL";

  if (checkout.kind === "REDIRECT") {
    return (
      <div className="space-y-3">
        <Heading id={headingLevel === 2 ? PAYMENT_HEADING_ID : undefined} tabIndex={-1} className={headingClass}>
          Thanh toán trên trang MoMo
        </Heading>
        {/* Nút "Mở trang thanh toán" là hành động chính của trang (cột phải / thanh dính đáy) — không lặp ở đây. */}
        <p className="text-sm leading-relaxed">
          Bấm “Mở trang thanh toán” để chuyển sang trang thanh toán của MoMo. Thanh toán xong, trang này tự cập nhật.
        </p>
      </div>
    );
  }

  if (checkout.kind === "QR") {
    const qrAlt = `Mã QR chuyển khoản ${formatVnd(order.totalVnd)} cho đơn hàng ${order.code}`;
    return (
      <div className="space-y-4">
        <Heading id={headingLevel === 2 ? PAYMENT_HEADING_ID : undefined} tabIndex={-1} className={headingClass}>
          Quét mã để thanh toán
        </Heading>
        <TransferDetails
          order="qr-first"
          rows={bankTransferRows({
            bank,
            accountNo: checkout.bank.accountNo,
            accountName: checkout.bank.accountName,
            amountVnd: order.totalVnd,
            content: checkout.content,
            contentFirst: true,
            contentNote: manual
              ? "Nhập đúng nguyên văn nội dung này để người bán nhận ra đơn của bạn."
              : "Nhập đúng nguyên văn nội dung này để hệ thống tự xác nhận đơn. Sai hoặc thiếu nội dung, đơn có thể không được xác nhận tự động.",
          })}
          qr={{ dataUrl: checkout.qrImageDataUrl, alt: qrAlt, ...(bank ? { caption: bank.shortName } : {}) }}
          amountVnd={order.totalVnd}
          referenceCode={order.code}
          intro={{
            mobile: "Tải ảnh QR rồi mở app ngân hàng → Quét QR → chọn ảnh, hoặc sao chép thông tin bên dưới.",
            wide: "Quét mã QR bằng app ngân hàng trên điện thoại, hoặc chuyển khoản theo các dòng thông tin chuyển khoản.",
          }}
        />
        <CautionNote icon={<IconInfo className="h-5 w-5" />}>
          {manual ? (
            <>
              <strong className="font-semibold">Chuyển đúng số tiền và nội dung.</strong> Người bán đối chiếu rồi xác nhận thủ công — bạn sẽ nhận email
              khi xong.
            </>
          ) : (
            <>
              <strong className="font-semibold">Chuyển đúng số tiền và nội dung để hệ thống tự xác nhận.</strong> Trang tự cập nhật, không cần tải lại.
            </>
          )}
        </CautionNote>
      </div>
    );
  }

  // WALLET — MoMo cá nhân, chuyển thủ công (ADR-059 bổ sung lần 3). Không popup (ADR-062).
  return (
    <div className="space-y-4">
      <Heading id={headingLevel === 2 ? PAYMENT_HEADING_ID : undefined} tabIndex={-1} className={headingClass}>
        Chuyển tiền qua Ví MoMo
      </Heading>
      <TransferDetails
        order="qr-first"
        rows={walletTransferRows({
          phone: checkout.phone,
          accountName: checkout.accountName,
          amountVnd: order.totalVnd,
          content: checkout.content,
          contentFirst: true,
          contentNote: "Nhập đúng nguyên văn nội dung này để người bán nhận ra đơn của bạn.",
        })}
        qr={checkout.qr ? { dataUrl: checkout.qr.qrImageDataUrl, alt: `Mã QR chuyển tiền MoMo ${formatVnd(order.totalVnd)} cho đơn hàng ${order.code}` } : null}
        amountVnd={order.totalVnd}
        referenceCode={order.code}
        intro={
          checkout.qr
            ? {
                mobile: "Tải ảnh QR rồi mở app MoMo → Quét mã → chọn ảnh, hoặc chuyển theo số điện thoại bên dưới.",
                wide: "Quét mã QR bằng app MoMo, hoặc chuyển tiền theo số điện thoại MoMo trong thông tin chuyển khoản.",
              }
            : {
                mobile: "Mở app MoMo → Chuyển tiền → nhập số điện thoại bên dưới.",
                wide: "Mở app MoMo → Chuyển tiền → nhập số điện thoại bên dưới.",
              }
        }
      />
      <CautionNote icon={<IconInfo className="h-5 w-5" />}>
        <strong className="font-semibold">Chuyển đúng số tiền và nội dung.</strong> Người bán đối chiếu lịch sử ví MoMo rồi xác nhận thủ công — bạn sẽ nhận
        email khi xong.
      </CautionNote>
      <p className="text-sm">
        <Link
          href={links.sellerPolicy}
          target="_blank"
          rel="noopener"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded font-medium text-[color:var(--color-primary)] underline underline-offset-2 ${FOCUS}`}
        >
          Chính sách người bán
          <IconExternalLink className="h-4 w-4" />
          <span className="sr-only">(mở tab mới)</span>
        </Link>
      </p>
    </div>
  );
}
