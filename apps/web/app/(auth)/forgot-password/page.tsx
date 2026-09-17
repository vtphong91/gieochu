"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
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
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
      <p className="mt-2 text-sm text-gray-600">
        Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <input
          type="email"
          placeholder="Email của bạn"
          className="w-full rounded border px-3 py-2"
          {...register("email", { required: true })}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý..." : "Gửi liên kết đặt lại mật khẩu"}
        </button>
        {message ? <p className="text-sm text-gray-600">{message}</p> : null}
      </form>
    </main>
  );
}
