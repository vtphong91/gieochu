"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { AccountTypeSelect, type AccountType } from "../_ui/account-type";
import { AuthCard } from "../_ui/auth-card";
import { ErrorBanner, PasswordField, SubmitButton, TextField } from "../_ui/fields";
import { INK_SOFT } from "../_ui/colors";

// Mirror của packages/auth/src/password.ts isValidPassword — chỉ để phản hồi
// sớm trên client, quy tắc thật vẫn do server enforce lại.
const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  consent: boolean;
}

export default function RegisterPage() {
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(data: RegisterFormValues) {
    if (!accountType) return;
    setServerError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, accountType }),
    });
    if (!response.ok) {
      const body = await response.json();
      setServerError(body.error?.message ?? "Đăng ký thất bại, vui lòng thử lại.");
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <AuthCard title="Kiểm tra email của bạn">
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Chúng tôi đã gửi liên kết kích hoạt tài khoản tới email bạn vừa đăng ký. Vui lòng kiểm tra hộp thư
          (và mục spam) để tiếp tục.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Tạo tài khoản"
      subtitle="Chọn loại tài khoản phù hợp để bắt đầu."
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium" style={{ color: "#0F3B82" }}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <AccountTypeSelect value={accountType} onChange={setAccountType} />

        {accountType ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <TextField
              id="fullName"
              label="Họ và tên"
              autoComplete="name"
              error={errors.fullName?.message}
              {...register("fullName", { required: "Vui lòng nhập họ tên." })}
            />
            <TextField
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email", {
                required: "Vui lòng nhập email.",
                pattern: { value: EMAIL_PATTERN, message: "Email không hợp lệ." },
              })}
            />
            <PasswordField
              id="password"
              label="Mật khẩu"
              autoComplete="new-password"
              hint="Ít nhất 8 ký tự, gồm cả chữ và số."
              error={errors.password?.message}
              {...register("password", {
                required: "Vui lòng nhập mật khẩu.",
                minLength: { value: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
                validate: (value) => HAS_LETTER_AND_DIGIT.test(value) || "Mật khẩu cần có cả chữ và số.",
              })}
            />
            <div>
              <label className="flex items-start gap-2.5 text-sm" style={{ color: INK_SOFT }}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded"
                  {...register("consent", { required: true })}
                />
                Tôi đồng ý với điều khoản sử dụng và chính sách xử lý dữ liệu cá nhân.
              </label>
              {errors.consent ? (
                <p role="alert" className="mt-1.5 text-sm" style={{ color: "#DC2626" }}>
                  Bạn cần đồng ý điều khoản trước khi tiếp tục.
                </p>
              ) : null}
            </div>
            <ErrorBanner message={serverError} />
            <SubmitButton loading={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : accountType === "TENANT" ? "Tạo tài khoản & mở gian hàng" : "Tạo tài khoản"}
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </AuthCard>
  );
}
