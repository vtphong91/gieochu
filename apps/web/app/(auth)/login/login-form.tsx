"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toSafeRedirect } from "../../../lib/safe-redirect";
import { AuthCard } from "../_ui/auth-card";
import { ErrorBanner, PasswordField, SubmitButton, TextField } from "../_ui/fields";

interface LoginFormValues {
  email: string;
  password: string;
}

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
  const router = useRouter();
  const searchParams = useSearchParams();

  async function onSubmit(data: LoginFormValues) {
    setServerError(null);
    setNeedsVerification(false);
    setNeedsPasswordReset(false);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) {
      if (body.error?.code === "EMAIL_NOT_VERIFIED") {
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
    router.push(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Đăng nhập"
      subtitle={`Chào mừng quay lại ${brandName}.`}
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium" style={{ color: "#0F3B82" }}>
            Đăng ký
          </Link>
        </>
      }
    >
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
        {needsVerification ? (
          <Link href="/verify-email?pending=1" className="block text-sm font-medium" style={{ color: "#0F3B82" }}>
            Gửi lại email kích hoạt
          </Link>
        ) : null}
        <ErrorBanner message={serverError} />
        {needsPasswordReset ? (
          <Link
            href="/forgot-password"
            className="block rounded-lg px-3.5 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: "#0F3B82" }}
          >
            Đặt lại mật khẩu ngay
          </Link>
        ) : null}
        <SubmitButton loading={isSubmitting}>{isSubmitting ? "Đang xử lý..." : "Đăng nhập"}</SubmitButton>
      </form>
      <div className="mt-4 text-right text-sm">
        <Link href="/forgot-password" className="font-medium" style={{ color: "#0F3B82" }}>
          Quên mật khẩu?
        </Link>
      </div>
    </AuthCard>
  );
}
