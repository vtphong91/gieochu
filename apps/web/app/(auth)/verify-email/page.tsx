"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

type VerifyStatus = "idle" | "verifying" | "success" | "error";

interface ResendFormValues {
  email: string;
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<VerifyStatus>(token ? "verifying" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ResendFormValues>();
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();
      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(body.error?.message ?? "Kích hoạt thất bại.");
      }
    })();
  }, [token]);

  async function onResend(data: ResendFormValues) {
    setResendMessage(null);
    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    setResendMessage(body.message ?? body.error?.message);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Kích hoạt tài khoản</h1>

      {status === "verifying" ? <p className="mt-4 text-gray-600">Đang kích hoạt...</p> : null}
      {status === "success" ? (
        <p className="mt-4 text-green-700">
          Kích hoạt thành công! Bạn có thể{" "}
          <a href="/login" className="text-[var(--color-primary)]">
            đăng nhập
          </a>
          .
        </p>
      ) : null}
      {status === "error" ? <p className="mt-4 text-red-600">{message}</p> : null}

      <div className="mt-8 text-left">
        <h2 className="text-lg font-semibold">Chưa nhận được email kích hoạt?</h2>
        <form onSubmit={handleSubmit(onResend)} className="mt-3 space-y-3">
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
            Gửi lại email kích hoạt
          </button>
          {resendMessage ? <p className="text-sm text-gray-600">{resendMessage}</p> : null}
        </form>
      </div>
    </main>
  );
}
