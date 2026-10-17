import type { Metadata } from "next";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { previewEmailChangeToken } from "../../../../lib/account-security";
import { IconAlertTriangle, IconMail } from "../../../admin/_ui/icons";
import { ConfirmEmailChangeForm } from "./confirm-form";

export const metadata: Metadata = { title: "Xác nhận đổi email", robots: { index: false, follow: false } };

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";

const STATUS_MESSAGE: Record<"invalid" | "expired" | "used", { title: string; body: string }> = {
  invalid: { title: "Liên kết không hợp lệ", body: "Liên kết không hợp lệ hoặc yêu cầu đổi email đã bị huỷ." },
  expired: { title: "Liên kết đã hết hạn", body: "Hãy gửi lại yêu cầu đổi email từ trang Bảo mật." },
  used: { title: "Liên kết đã được sử dụng", body: "Email có thể đã được đổi. Hãy đăng nhập bằng email mới." },
};

const LINK_BTN = "inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold outline-offset-2 focus-visible:outline-2";

/**
 * ADR-041 C5 — trang xác nhận đổi email (`/account/email/xac-nhan?token=…`). GET chỉ hiển thị trạng thái token, không
 * ghi gì; đổi email chỉ khi bấm nút. Không yêu cầu đăng nhập (layout `/account` chỉ hiện header khi chưa đăng nhập).
 * Form đơn lẻ: khung `max-w-md` (tương đương `container-narrow` trong app shell — ADR-024 §4.4).
 */
export default async function ConfirmEmailChangePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const preview = await previewEmailChangeToken(token);
  const valid = preview.status === "valid" && preview.newEmail;
  const problem = STATUS_MESSAGE[preview.status === "valid" ? "invalid" : preview.status];

  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="rounded-2xl border bg-white p-6 sm:p-8" style={{ borderColor: LINE }}>
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={valid ? { background: brandColors.surface, color: BLUE } : { background: brandColors.accentSoft, color: "#92400E" }}
        >
          {valid ? <IconMail className="h-6 w-6" /> : <IconAlertTriangle className="h-6 w-6" />}
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-bold" style={{ color: INK }}>
          {valid ? "Xác nhận đổi email" : problem.title}
        </h1>
        {valid && preview.newEmail ? (
          <div className="mt-5">
            <ConfirmEmailChangeForm token={token} newEmail={preview.newEmail} />
          </div>
        ) : (
          <div className="mt-3 space-y-5">
            <p role="alert" className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
              {problem.body}
            </p>
            <div className="flex flex-col gap-2">
              {preview.status === "used" ? (
                <Link href="/login" className={`${LINK_BTN} text-white hover:brightness-110`} style={{ background: BLUE, outlineColor: BLUE }}>
                  Đăng nhập
                </Link>
              ) : null}
              <Link
                href="/account/security#email"
                className={`${LINK_BTN} ${preview.status === "used" ? "border bg-white hover:bg-gray-50" : "text-white hover:brightness-110"}`}
                style={preview.status === "used" ? { borderColor: LINE, color: INK, outlineColor: BLUE } : { background: BLUE, outlineColor: BLUE }}
              >
                Về trang Bảo mật
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
