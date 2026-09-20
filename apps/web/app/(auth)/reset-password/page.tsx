"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { AuthCard } from "../_ui/auth-card";
import { ErrorBanner, PasswordField, SubmitButton } from "../_ui/fields";
import { INK_SOFT } from "../_ui/colors";

const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).+$/;

interface ResetPasswordFormValues {
  newPassword: string;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!token) {
      setMessage("Thiếu liên kết đặt lại mật khẩu.");
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: data.newPassword }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error?.message ?? "Đặt lại mật khẩu thất bại.");
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <AuthCard title="Đặt lại mật khẩu thành công">
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Vui lòng{" "}
          <Link href="/login" className="font-medium" style={{ color: "#0F3B82" }}>
            đăng nhập
          </Link>{" "}
          lại với mật khẩu mới.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Đặt lại mật khẩu">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <PasswordField
          id="newPassword"
          label="Mật khẩu mới"
          autoComplete="new-password"
          hint="Ít nhất 8 ký tự, gồm cả chữ và số."
          error={errors.newPassword?.message}
          {...register("newPassword", {
            required: "Vui lòng nhập mật khẩu mới.",
            minLength: { value: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
            validate: (value) => HAS_LETTER_AND_DIGIT.test(value) || "Mật khẩu cần có cả chữ và số.",
          })}
        />
        <ErrorBanner message={message} />
        <SubmitButton loading={isSubmitting}>{isSubmitting ? "Đang xử lý..." : "Đặt lại mật khẩu"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
