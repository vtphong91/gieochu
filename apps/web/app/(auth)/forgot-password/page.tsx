"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { AuthCard } from "../_ui/auth-card";
import { InfoBanner, SubmitButton, TextField } from "../_ui/fields";

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(data: ForgotPasswordFormValues) {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    setMessage(body.message ?? "Đã gửi yêu cầu.");
  }

  return (
    <AuthCard
      title="Quên mật khẩu"
      subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu."
      footer={
        <Link href="/login" className="font-medium" style={{ color: "#0F3B82" }}>
          Quay lại đăng nhập
        </Link>
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
        <InfoBanner message={message} />
        <SubmitButton loading={isSubmitting}>{isSubmitting ? "Đang xử lý..." : "Gửi liên kết đặt lại mật khẩu"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
