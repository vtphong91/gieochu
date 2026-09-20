"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toSafeRedirect } from "../../../lib/safe-redirect";
import { AuthCard } from "../_ui/auth-card";
import { ErrorBanner, InfoBanner, SubmitButton, TextField } from "../_ui/fields";
import { INK, INK_SOFT } from "../_ui/colors";

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
  // `next` được register API gắn vào link kích hoạt (TENANT -> /studio,
  // CUSTOMER -> /) — giữ nguyên qua bước verify rồi truyền tiếp cho /login.
  const next = toSafeRedirect(searchParams.get("next"));
  const [status, setStatus] = useState<VerifyStatus>(token ? "verifying" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendFormValues>();
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
    <AuthCard title="Kích hoạt tài khoản">
      {status === "verifying" ? (
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Đang kích hoạt...
        </p>
      ) : null}
      {status === "success" ? (
        <p className="text-sm font-medium" style={{ color: "#166B3F" }}>
          Kích hoạt thành công!{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline" style={{ color: "#0F3B82" }}>
            Đăng nhập ngay
          </Link>
          .
        </p>
      ) : null}
      {status === "error" ? <ErrorBanner message={message} /> : null}

      <div className="mt-8">
        <h2 className="text-base font-semibold" style={{ color: INK }}>
          Chưa nhận được email kích hoạt?
        </h2>
        <form onSubmit={handleSubmit(onResend)} className="mt-3 space-y-3">
          <TextField
            id="resend-email"
            type="email"
            label="Email của bạn"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email", { required: "Vui lòng nhập email." })}
          />
          <SubmitButton loading={isSubmitting}>Gửi lại email kích hoạt</SubmitButton>
          <InfoBanner message={resendMessage} />
        </form>
      </div>
    </AuthCard>
  );
}
