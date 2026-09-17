"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

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
    formState: { isSubmitting },
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
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Đặt lại mật khẩu thành công</h1>
        <p className="mt-4 text-gray-600">
          Vui lòng{" "}
          <Link href="/login" className="text-[var(--color-primary)]">
            đăng nhập
          </Link>{" "}
          lại với mật khẩu mới.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="newPassword">
            Mật khẩu mới
          </label>
          <input
            id="newPassword"
            type="password"
            className="mt-1 w-full rounded border px-3 py-2"
            {...register("newPassword", { required: true, minLength: 8 })}
          />
          <p className="mt-1 text-xs text-gray-500">Ít nhất 8 ký tự, gồm cả chữ và số.</p>
        </div>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý..." : "Đặt lại mật khẩu"}
        </button>
      </form>
    </main>
  );
}
