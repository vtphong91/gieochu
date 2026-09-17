"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

interface LoginFormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function onSubmit(data: LoginFormValues) {
    setServerError(null);
    setNeedsVerification(false);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json();
      if (body.error?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      }
      setServerError(body.error?.message ?? "Đăng nhập thất bại.");
      return;
    }
    const next = searchParams.get("next") ?? "/account/profile";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
            {...register("password", { required: true })}
          />
        </div>
        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
        {needsVerification ? (
          <Link href="/verify-email?pending=1" className="block text-sm text-[var(--color-primary)]">
            Gửi lại email kích hoạt
          </Link>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <Link href="/register" className="text-[var(--color-primary)]">
          Tạo tài khoản
        </Link>
        <Link href="/forgot-password" className="text-[var(--color-primary)]">
          Quên mật khẩu?
        </Link>
      </div>
    </main>
  );
}
