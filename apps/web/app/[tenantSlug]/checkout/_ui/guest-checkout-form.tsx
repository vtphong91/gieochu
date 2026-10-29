"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { PaymentProviderId } from "@gieochu/payments";
import { IconAlertTriangle, IconExternalLink } from "../../../admin/_ui/icons";
import { startGuestCheckoutAction, type GuestCheckoutActionState } from "../actions";
import { FOCUS, MobileActionBar, PRIMARY_BTN } from "../[orderCode]/_ui/checkout-parts";
import { ProviderOptionCard } from "../[orderCode]/_ui/payment-method-panel";

/**
 * ADR-061 Q1 / ADR-062 Q2 — form khách vãng lai CHƯA có đơn (wireframe §3.5, §4.2). Bọc cả lưới 2 cột của trang để nút chính
 * nằm được ở cột phải (từ lg) và trên thanh dính đáy (mobile) mà vẫn thuộc cùng một `<form>` / một trạng thái `pending`.
 * Server truyền các khối trình bày (tóm tắt, tiến độ) qua slot.
 *
 * Lỗi: dưới từng ô (`aria-describedby` + `aria-invalid`, có icon + chữ — không chỉ màu). Sau khi gửi lỗi: ≥2 ô lỗi → hộp tóm
 * tắt đầu form nhận focus (link tới từng ô); 1 ô lỗi → focus ô đó; lỗi chung (giới hạn tần suất, tài liệu ngừng bán…) → hộp
 * `role="alert"` đầu form nhận focus. Một ô đồng ý duy nhất, KHÔNG tick sẵn (ADR-062 Q11).
 */
export interface GuestCheckoutFormProps {
  tenantSlug: string;
  productSlug: string;
  productPath: string;
  providers: { id: PaymentProviderId; label: string; confirmMode: "MANUAL" | "AUTO" }[];
  /** Tổng hiển thị (server tính). 0 = tài liệu miễn phí → không cần chọn phương thức. */
  totalVnd: number;
  links: { terms: string; privacy: string; login: string };
  /** URL gửi lại email kích hoạt (trang /verify-email) khi email đã thuộc tài khoản tạo lúc mua chưa kích hoạt. */
  resendHref: string;
  /** Dải tóm tắt (dưới lg), thẻ tóm tắt (từ lg), tiến độ — khối server. */
  mobileSummary: ReactNode;
  sideSummary: ReactNode;
  progress: ReactNode;
}

type FieldKey = "fullName" | "email" | "provider" | "acceptTerms";
const FIELD_ORDER: FieldKey[] = ["fullName", "email", "provider", "acceptTerms"];
const FIELD_ID: Record<FieldKey, string> = {
  fullName: "guest-fullName",
  email: "guest-email",
  provider: "guest-provider-0",
  acceptTerms: "guest-acceptTerms",
};

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const initialState: GuestCheckoutActionState = {};
/** Ô nhập ≥44px, chữ 16px (iOS không tự phóng to). Viền mặc định `line` qua style; lỗi → class đỏ (không đặt style). */
const INPUT = `mt-1.5 block min-h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 text-base outline-none ${FOCUS}`;
const INPUT_ERROR = "border-2 border-red-700";
const TEXT_LINK = `rounded font-medium text-[color:var(--color-primary)] underline underline-offset-2 ${FOCUS}`;

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex gap-1.5 text-sm font-medium text-red-700">
      <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-red-700">
        {" "}
        *
      </span>
      <span className="sr-only"> (bắt buộc)</span>
    </>
  );
}

export function GuestCheckoutForm({
  tenantSlug,
  productSlug,
  productPath,
  providers,
  totalVnd,
  links,
  resendHref,
  mobileSummary,
  sideSummary,
  progress,
}: GuestCheckoutFormProps) {
  const action = startGuestCheckoutAction.bind(null, tenantSlug, productSlug);
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  const errorKeys = FIELD_ORDER.filter((key) => errors[key]);
  const free = totalVnd === 0;
  const noProvider = !free && providers.length === 0;
  const summaryRef = useRef<HTMLDivElement>(null);

  // Quản lý focus sau mỗi lần gửi lỗi (state là object mới mỗi lần action trả về).
  useEffect(() => {
    if (state === initialState) return;
    const keys = FIELD_ORDER.filter((key) => state.fieldErrors?.[key]);
    if (keys.length === 1) {
      document.getElementById(FIELD_ID[keys[0]!])?.focus();
    } else if (keys.length > 1 || state.error) {
      summaryRef.current?.focus();
    }
  }, [state]);

  const submitLabel = pending ? "Đang tạo đơn…" : free ? "Nhận tài liệu" : "Tiếp tục thanh toán";
  const submitButton = (className: string) => (
    <button type="submit" disabled={pending || noProvider} aria-busy={pending || undefined} className={className} style={{ background: "var(--color-primary)" }}>
      {submitLabel}
    </button>
  );

  const emailDescribedBy = [errors.email ? "guest-email-error" : null, "guest-email-hint"].filter(Boolean).join(" ");

  return (
    <form action={formAction} noValidate className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-5">
        {mobileSummary}

        {/* Tóm tắt lỗi (≥2 ô) hoặc lỗi chung — đầu form, nhận focus sau khi gửi. */}
        {errorKeys.length > 1 ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="guest-error-title"
            className="rounded-xl border border-l-4 border-red-700 bg-red-50 p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            style={{ color: INK }}
          >
            <p id="guest-error-title" className="flex items-center gap-2 font-semibold text-red-700">
              <IconAlertTriangle className="h-5 w-5 shrink-0" />
              {state.error ?? "Vui lòng kiểm tra lại thông tin."}
            </p>
            <ul className="mt-2 space-y-1 pl-7">
              {errorKeys.map((key) => (
                <li key={key}>
                  <a href={`#${FIELD_ID[key]}`} className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                    {errors[key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : state.error && errorKeys.length === 0 ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="flex gap-2.5 rounded-xl border border-l-4 border-red-700 bg-red-50 p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            style={{ color: INK }}
          >
            <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <div className="min-w-0">
              <p className="font-semibold">{state.error}</p>
              {state.code === "ALREADY_SIGNED_IN" ? (
                <Link href={productPath} className={`mt-1 inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                  Về trang tài liệu
                </Link>
              ) : state.code === "PRODUCT_UNAVAILABLE" ? (
                <Link href={`/${tenantSlug}`} className={`mt-1 inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                  Về gian hàng
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ── Thông tin người mua (§4.2) ── */}
        <section aria-labelledby="guest-buyer-title" className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE }}>
          <h2 id="guest-buyer-title" className="font-[family-name:var(--font-heading)] text-xl font-bold">
            Thông tin người mua
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
            Không cần đăng ký trước — chúng tôi tạo tài khoản cho bạn và gửi email để đặt mật khẩu sau.
          </p>
          <p className="text-sm">
            <Link href={links.login} className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
              Đã có tài khoản? Đăng nhập
            </Link>
          </p>

          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor={FIELD_ID.fullName} className="block text-sm font-medium" style={{ color: INK }}>
                Họ và tên
                <RequiredMark />
              </label>
              <input
                id={FIELD_ID.fullName}
                name="fullName"
                autoComplete="name"
                required
                maxLength={100}
                defaultValue={state.values?.fullName ?? ""}
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={errors.fullName ? "guest-fullName-error" : undefined}
                className={`${INPUT} ${errors.fullName ? INPUT_ERROR : ""}`}
                style={errors.fullName ? undefined : { borderColor: LINE }}
              />
              {errors.fullName ? <FieldError id="guest-fullName-error">{errors.fullName}</FieldError> : null}
            </div>

            <div>
              <label htmlFor={FIELD_ID.email} className="block text-sm font-medium" style={{ color: INK }}>
                Email nhận tài liệu
                <RequiredMark />
              </label>
              <input
                id={FIELD_ID.email}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                defaultValue={state.values?.email ?? ""}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={emailDescribedBy}
                className={`${INPUT} ${errors.email ? INPUT_ERROR : ""}`}
                style={errors.email ? undefined : { borderColor: LINE }}
              />
              {errors.email ? (
                <FieldError id="guest-email-error">
                  {errors.email}
                  {state.code === "EMAIL_EXISTS_GUEST" || state.code === "EMAIL_EXISTS" ? (
                    <span className="mt-0.5 flex flex-wrap gap-x-4">
                      <Link href={links.login} className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                        {state.code === "EMAIL_EXISTS" ? "Đăng nhập để tiếp tục mua" : "Đăng nhập"}
                      </Link>
                      {state.code === "EMAIL_EXISTS_GUEST" ? (
                        <Link href={resendHref} className={`inline-flex min-h-11 items-center ${TEXT_LINK}`}>
                          Gửi lại email kích hoạt
                        </Link>
                      ) : null}
                    </span>
                  ) : null}
                </FieldError>
              ) : null}
              <p id="guest-email-hint" className="mt-1.5 text-sm" style={{ color: INK_SOFT }}>
                Tài liệu và hướng dẫn kích hoạt tài khoản được gửi về email này.
              </p>
            </div>
          </div>
        </section>

        {/* ── Cách thanh toán (§4.3) — cùng thẻ radio với trang đơn ── */}
        {free ? null : (
          <section aria-labelledby="guest-provider-title" className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: LINE }}>
            <fieldset aria-describedby={errors.provider ? "guest-provider-error" : undefined} className="space-y-2.5">
              <legend id="guest-provider-title" className="mb-3 font-[family-name:var(--font-heading)] text-xl font-bold">
                Cách thanh toán
                {providers.length > 0 ? <RequiredMark /> : null}
              </legend>
              {providers.length === 0 ? (
                <p className="rounded-xl border p-3.5 text-sm leading-relaxed" style={{ borderColor: LINE, background: brandColors.surface, color: INK }}>
                  Người bán chưa bật cách thanh toán nào. Vui lòng quay lại sau hoặc liên hệ người bán.
                </p>
              ) : (
                providers.map((provider, index) => (
                  <ProviderOptionCard
                    key={provider.id}
                    option={provider}
                    inputId={index === 0 ? FIELD_ID.provider : undefined}
                    defaultChecked={state.values?.provider ? state.values.provider === provider.id : index === 0}
                    describedBy={errors.provider ? "guest-provider-error" : undefined}
                  />
                ))
              )}
              {errors.provider ? <FieldError id="guest-provider-error">{errors.provider}</FieldError> : null}
            </fieldset>
            {providers.length > 0 ? (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
                Có mã giảm giá? Bạn nhập được ở bước tiếp theo, ngay khi đơn được tạo — trước khi chuyển tiền.
              </p>
            ) : null}
          </section>
        )}

        {/* ── Ô đồng ý duy nhất (ADR-062 Q11) — vùng bấm cả dòng ≥44px, ô 20px. ── */}
        <div>
          {/* Cả khung là `label` → bấm bất kỳ đâu (trừ 2 link) đều đổi ô; bấm link chỉ mở trang, không đổi trạng thái ô. */}
          <label
            htmlFor={FIELD_ID.acceptTerms}
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm leading-relaxed has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[color:var(--color-primary)] ${errors.acceptTerms ? "border-2 border-red-700" : ""}`}
            style={errors.acceptTerms ? { color: INK } : { borderColor: LINE, color: INK }}
          >
            <input
              id={FIELD_ID.acceptTerms}
              type="checkbox"
              name="acceptTerms"
              required
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? "guest-terms-error" : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
            />
            <span className="min-w-0 flex-1">
              Tôi xác nhận thông tin chính xác và đồng ý{" "}
              <Link href={links.terms} target="_blank" rel="noopener" className={TEXT_LINK}>
                Điều khoản
                <IconExternalLink className="ml-0.5 inline h-3.5 w-3.5 align-[-2px]" />
                <span className="sr-only"> (mở tab mới)</span>
              </Link>{" "}
              và{" "}
              <Link href={links.privacy} target="_blank" rel="noopener" className={TEXT_LINK}>
                Chính sách bảo mật
                <IconExternalLink className="ml-0.5 inline h-3.5 w-3.5 align-[-2px]" />
                <span className="sr-only"> (mở tab mới)</span>
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms ? <FieldError id="guest-terms-error">{errors.acceptTerms}</FieldError> : null}
        </div>

        <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
          {free
            ? "Bấm “Nhận tài liệu” để tạo đơn và thêm tài liệu vào Thư viện của bạn."
            : "Bấm “Tiếp tục thanh toán” để tạo đơn và nhận mã QR, thông tin chuyển khoản. Bạn vẫn đổi được cách thanh toán khi chưa chuyển tiền."}
        </p>
      </div>

      <aside aria-label="Đơn hàng và tiến độ" className="min-w-0 space-y-5 lg:sticky lg:top-[112px]">
        {sideSummary}
        <div className="hidden lg:block">{submitButton(`${PRIMARY_BTN} w-full`)}</div>
        {progress}
      </aside>

      <MobileActionBar totalVnd={totalVnd}>{submitButton(`${PRIMARY_BTN} w-full max-w-64 px-4 text-[15px]`)}</MobileActionBar>
    </form>
  );
}
