"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { AccountTypeSelect, type AccountType } from "../_ui/account-type";
import { AuthCard } from "../_ui/auth-card";
import { ErrorBanner, PasswordField, SubmitButton, TextField } from "../_ui/fields";
import { IconExternalLink } from "../../admin/_ui/icons";
import { BLUE, INK_SOFT, LINE } from "../_ui/colors";

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

/** Bản văn bản đang hiệu lực (Điều khoản — ADR-050; Chính sách bảo mật — ADR-054) — `null` = chưa công bố. */
export interface RegisterTermsInfo {
  /** `null` = bản đang hiển thị là bản dự thảo (ADR-057) — có link để đọc, không ghi chấp thuận theo phiên bản. */
  versionId: string | null;
  href: string;
  title: string;
}

function LegalLink({ doc }: { doc: RegisterTermsInfo }) {
  return (
    <Link
      href={doc.href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm font-semibold underline underline-offset-2 outline-offset-2 focus-visible:outline-2"
      style={{ color: BLUE, outlineColor: BLUE }}
    >
      {doc.title}
      <IconExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
      <span className="sr-only"> (mở trong tab mới)</span>
    </Link>
  );
}

/** Form đăng ký (client). Tên thương hiệu do page (server) đọc từ `getEffectiveBrand()` truyền xuống (ADR-032). */
export function RegisterForm({ brandName, terms, privacy }: { brandName: string; terms: RegisterTermsInfo | null; privacy: RegisterTermsInfo | null }) {
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
      body: JSON.stringify({
        ...data,
        accountType,
        ...(terms?.versionId ? { termsVersionId: terms.versionId } : {}),
        ...(privacy?.versionId ? { privacyVersionId: privacy.versionId } : {}),
      }),
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
        <AccountTypeSelect value={accountType} onChange={setAccountType} brandName={brandName} />

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
            {/* Chấp thuận điều khoản (ADR-050): ô 18px nằm trong nhãn cao ≥ 44px (cả dòng bấm được); có bản Điều khoản đang hiệu
                lực → tên văn bản là link mở tab mới (biểu tượng + chữ ẩn). Lỗi gắn `aria-describedby` + `aria-invalid`. */}
            <div>
              <label
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm leading-relaxed"
                style={{ borderColor: errors.consent ? "#DC2626" : LINE, background: "white", color: INK_SOFT }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-[color:var(--brand-primary,#0F3B82)]"
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? "consent-error" : undefined}
                  {...register("consent", { required: true })}
                />
                <span>
                  {/* ADR-054 mục 5: mỗi văn bản có bản hiệu lực thì thành link; chưa có thì giữ chữ thường như cũ. */}
                  Tôi đồng ý với {terms ? <LegalLink doc={terms} /> : "điều khoản sử dụng"} và{" "}
                  {privacy ? <LegalLink doc={privacy} /> : "chính sách xử lý dữ liệu cá nhân"}.
                </span>
              </label>
              {errors.consent ? (
                <p id="consent-error" role="alert" className="mt-1.5 text-sm" style={{ color: "#DC2626" }}>
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
