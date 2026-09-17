"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";

interface RegisterFormValues {
  email: string;
  password: string;
  fullName: string;
  consent: boolean;
}

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(data: RegisterFormValues) {
    setServerError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
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
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Kiểm tra email của bạn</h1>
        <p className="mt-4 text-gray-600">
          Chúng tôi đã gửi liên kết kích hoạt tài khoản. Vui lòng kiểm tra hộp thư (và mục spam).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Đăng ký</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="fullName">
            Họ và tên
          </label>
          <input
            id="fullName"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("fullName", { required: true })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("email", { required: true })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("password", { required: true, minLength: 8 })}
          />
          <p className="mt-1 text-xs text-gray-500">Ít nhất 8 ký tự, gồm cả chữ và số.</p>
        </div>
        <div className="flex items-start gap-2">
          <input id="consent" type="checkbox" className="mt-1" {...register("consent", { required: true })} />
          <label htmlFor="consent" className="text-sm">
            Tôi đồng ý với điều khoản sử dụng và chính sách xử lý dữ liệu cá nhân.
          </label>
        </div>
        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-[var(--color-primary)]">
          Đăng nhập
        </Link>
      </p>
    </main>
  );
}
