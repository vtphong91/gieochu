import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../../_ui/auth-card";
import { ErrorBanner } from "../../_ui/fields";
import { ActivateGuestForm } from "./activate-form";

export const metadata: Metadata = { title: "Kích hoạt tài khoản và đặt mật khẩu", robots: { index: false, follow: false } };

const RESEND_HREF = "/verify-email?pending=1";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

/**
 * ADR-061 Q1 — trang đích của email "Kích hoạt tài khoản và đặt mật khẩu" (tài khoản tạo lúc mua không cần đăng ký). Không
 * cần đăng nhập. Token chỉ được kiểm khi gửi form (Server Action) — trang không tiêu token khi chỉ mở (trình quét link của hộp
 * thư không làm hỏng liên kết). Dùng chung khung `AuthCard` + kit `(auth)/_ui/fields` với đăng nhập/đăng ký.
 */
export default async function ActivateGuestPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token?.trim() ?? "";
  return (
    <AuthCard
      title="Kích hoạt tài khoản"
      subtitle="Đặt mật khẩu để đăng nhập lại và tải tài liệu đã mua trên mọi thiết bị."
      footer={
        token ? (
          <>
            Liên kết hết hạn?{" "}
            <Link href={RESEND_HREF} className={`inline-flex min-h-11 items-center rounded font-medium text-[color:var(--color-primary)] underline underline-offset-2 ${FOCUS}`}>
              Gửi lại email kích hoạt
            </Link>
          </>
        ) : undefined
      }
    >
      {token ? (
        <ActivateGuestForm token={token} resendHref={RESEND_HREF} />
      ) : (
        <div className="space-y-3">
          <ErrorBanner message="Liên kết kích hoạt không hợp lệ hoặc thiếu mã. Hãy mở lại đúng liên kết trong email, hoặc gửi lại email kích hoạt." />
          <Link
            href={RESEND_HREF}
            className={`flex min-h-11 items-center justify-center rounded-lg px-3.5 text-sm font-semibold text-white transition hover:brightness-110 motion-reduce:transition-none ${FOCUS}`}
            style={{ background: "var(--color-primary)" }}
          >
            Gửi lại email kích hoạt
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
