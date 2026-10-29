"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toSafeRedirect } from "../../../lib/safe-redirect";
import { AuthCard } from "../_ui/auth-card";
import { INK_SOFT } from "../_ui/colors";
import { ErrorBanner, InfoBanner, PasswordField, SubmitButton, SuccessBanner, TextField } from "../_ui/fields";

const AUTH_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

interface LoginFormValues {
  email: string;
  password: string;
  /** ADR-053: "Ghi nhớ đăng nhập" — mặc định tắt; server bỏ qua với SYSTEM_ADMIN. */
  rememberMe: boolean;
}

/** Chống vòng lặp khôi phục phiên (trang cần đăng nhập → /login → khôi phục → trang đó → /login...). Chỉ lưu mốc thời gian. */
const RESUME_GUARD_KEY = "gieochu-session-resume-at";
const RESUME_GUARD_MS = 30_000;

/** Form đăng nhập (client). Tên thương hiệu do page (server) đọc từ `getEffectiveBrand()` truyền xuống (ADR-032). */
export function LoginForm({ brandName }: { brandName: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const searchParams = useSearchParams();
  const sessionTimedOut = searchParams.get("het-phien") === "1";
  const justActivated = searchParams.get("da-kich-hoat") === "1";

  // ADR-053: access token hết hạn nhưng refresh "Ghi nhớ" còn → trang cần đăng nhập chuyển về đây; thử khôi phục phiên
  // một lần rồi quay lại trang đích. Vừa hết phiên do idle (`het-phien`) thì không thử.
  useEffect(() => {
    if (sessionTimedOut) return;
    try {
      const last = Number(window.sessionStorage.getItem(RESUME_GUARD_KEY) ?? "0");
      if (Date.now() - last < RESUME_GUARD_MS) return;
      window.sessionStorage.setItem(RESUME_GUARD_KEY, String(Date.now()));
    } catch {
      return; // sessionStorage bị chặn → bỏ qua khôi phục (không có cách chống vòng lặp).
    }
    let cancelled = false;
    void fetch("/api/auth/refresh", { method: "POST" })
      .then((response) => {
        if (!cancelled && response.ok) window.location.assign(toSafeRedirect(searchParams.get("next"), "/"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionTimedOut, searchParams]);

  async function onSubmit(data: LoginFormValues) {
    setServerError(null);
    setNeedsVerification(false);
    setNeedsPasswordReset(false);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password, rememberMe: data.rememberMe === true }),
    });
    const body = await response.json();
    if (!response.ok) {
      // ADR-061 Q1: tài khoản tạo lúc mua (chưa đặt mật khẩu) → cùng lối "Gửi lại email kích hoạt" (email kích hoạt + đặt mật khẩu).
      if (body.error?.code === "EMAIL_NOT_VERIFIED" || body.error?.code === "GUEST_NOT_ACTIVATED") {
        setNeedsVerification(true);
      }
      if (body.error?.code === "PASSWORD_RESET_REQUIRED") {
        setNeedsPasswordReset(true);
      }
      setServerError(body.error?.message ?? "Đăng nhập thất bại.");
      return;
    }
    // Không có `next` tường minh (không tới từ 1 luồng cụ thể như xác minh
    // email/checkout) -> đưa theo đúng module được phép: `landingPath` do
    // server tính qua resolveLandingPath() (ADR-022) — SYSTEM_ADMIN vào
    // System Center, chủ tenant vào thẳng Studio của mình, còn lại về trang
    // chủ. Không còn ép ai cũng phải qua /account/profile trước khi dùng hệ
    // thống (đã bỏ cổng hoàn thiện hồ sơ bắt buộc, xem requireVerifiedAccess()
    // ở lib/page-guards.ts).
    const roleDefault = body.user?.landingPath ?? "/";
    const next = toSafeRedirect(searchParams.get("next"), roleDefault);
    // ADR-053: điều hướng cứng — xoá toàn bộ client cache (layout prefetch của /pricing, /cua-hang… còn header "khách").
    // `router.push` + `router.refresh` chỉ xoá cache của route hiện tại; cookie đặt qua Route Handler không invalidate.
    window.location.assign(next);
  }

  return (
    <AuthCard
      title="Đăng nhập"
      subtitle={`Chào mừng quay lại ${brandName}.`}
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link href="/register" className={`rounded font-medium text-[color:var(--color-primary)] ${AUTH_FOCUS}`}>
            Đăng ký
          </Link>
        </>
      }
    >
      {justActivated ? (
        <div className="mb-4">
          <SuccessBanner title="Đã kích hoạt tài khoản" message="Mật khẩu đã được đặt. Đăng nhập để tải tài liệu đã mua trên mọi thiết bị." />
        </div>
      ) : null}
      {sessionTimedOut ? (
        <div className="mb-4">
          <InfoBanner message="Phiên đăng nhập đã kết thúc để bảo vệ tài khoản. Vui lòng đăng nhập lại." />
        </div>
      ) : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField
          id="email"
          type="email"
          label="Email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email", { required: "Vui lòng nhập email." })}
        />
        <PasswordField
          id="password"
          label="Mật khẩu"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password", { required: "Vui lòng nhập mật khẩu." })}
        />
        {/* ADR-053: mặc định tắt. Quản trị viên hệ thống: server luôn bỏ qua (phiên kết thúc khi đóng trình duyệt). */}
        {/* `label` bao cả ô → vùng bấm cả dòng ≥44px; dòng phụ gắn qua aria-describedby, thẳng hàng với chữ của nhãn. */}
        <div>
          <label htmlFor="rememberMe" className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
            <input
              id="rememberMe"
              type="checkbox"
              aria-describedby="rememberMe-hint"
              className="h-4 w-4 shrink-0 cursor-pointer"
              style={{ accentColor: "var(--color-primary)" }}
              {...register("rememberMe")}
            />
            Ghi nhớ đăng nhập trên thiết bị này
          </label>
          <p id="rememberMe-hint" className="-mt-2 pl-[26px] text-xs" style={{ color: INK_SOFT }}>
            Không dùng trên máy dùng chung.
          </p>
        </div>
        <ErrorBanner message={serverError} />
        {/* EMAIL_NOT_VERIFIED / GUEST_NOT_ACTIVATED (ADR-061 Q1, Bổ sung ADR-062 mục 4): lối ra ngay dưới thông báo lỗi —
            nút viền ≥44px (hành động phụ, nút chính vẫn là "Đăng nhập"). */}
        {needsVerification ? (
          <Link
            href="/verify-email?pending=1"
            className={`flex min-h-11 items-center justify-center rounded-lg border bg-white px-3.5 text-sm font-semibold text-[color:var(--color-primary)] transition-colors hover:bg-gray-50 motion-reduce:transition-none ${AUTH_FOCUS}`}
            style={{ borderColor: "var(--color-primary)" }}
          >
            Gửi lại email kích hoạt
          </Link>
        ) : null}
        {needsPasswordReset ? (
          <Link
            href="/forgot-password"
            className={`flex min-h-11 items-center justify-center rounded-lg px-3.5 text-center text-sm font-semibold text-white transition hover:brightness-110 motion-reduce:transition-none ${AUTH_FOCUS}`}
            style={{ background: "var(--color-primary)" }}
          >
            Đặt lại mật khẩu ngay
          </Link>
        ) : null}
        <SubmitButton loading={isSubmitting}>{isSubmitting ? "Đang xử lý..." : "Đăng nhập"}</SubmitButton>
      </form>
      <div className="mt-4 text-right text-sm">
        <Link href="/forgot-password" className={`inline-flex min-h-11 items-center rounded font-medium text-[color:var(--color-primary)] ${AUTH_FOCUS}`}>
          Quên mật khẩu?
        </Link>
      </div>
    </AuthCard>
  );
}
