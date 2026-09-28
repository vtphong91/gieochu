"use client";

import { useActionState, useEffect, useRef, useTransition, type FormEvent } from "react";
import { submitStorefrontContactAction, type StorefrontContactResult } from "../actions";
import { IconCheck, IconInfo } from "./icons";
import { pillClass } from "./primitives";

const INPUT =
  "block w-full rounded-md border bg-white px-4 text-[15px] text-[color:var(--sf-ink)] placeholder:text-[#6b7280] transition-colors outline-none focus-visible:border-[color:var(--sf-primary-text)] focus-visible:outline-2 focus-visible:outline-offset-0";

/**
 * Form liên hệ (mẫu "Let's work together"): Tên | Email 1 hàng, lời nhắn, nút pill.
 * Nhãn ẩn trực quan (placeholder trùng nội dung nhãn như mẫu) nhưng vẫn là <label>
 * thật cho trình đọc màn hình. Gửi qua `onSubmit` + transition để React KHÔNG reset
 * các ô khi server trả lỗi (người dùng không mất lời nhắn); không có JS thì form
 * vẫn gửi qua `action` (progressive enhancement).
 */
export function ContactForm({
  tenantSlug,
  formTitle,
  successMessage,
  formId,
}: {
  tenantSlug: string;
  formTitle?: string;
  successMessage: string;
  formId: string;
}) {
  const [state, formAction, isPending] = useActionState<StorefrontContactResult | null, FormData>(
    submitStorefrontContactAction.bind(null, tenantSlug),
    null,
  );
  const [, startTransition] = useTransition();
  const successRef = useRef<HTMLDivElement>(null);
  const succeeded = state !== null && "ok" in state;
  const error = state !== null && "error" in state ? state.error : null;

  useEffect(() => {
    if (succeeded) successRef.current?.focus();
  }, [succeeded]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const titleId = `${formId}-title`;

  if (succeeded) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex h-full flex-col items-center justify-center rounded-xl border bg-white px-6 py-12 text-center outline-none"
        style={{ borderColor: "var(--sf-line)" }}
      >
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--sf-primary)", color: "var(--sf-on-primary)" }}>
          <IconCheck className="h-7 w-7" />
        </span>
        <p className="font-[family-name:var(--font-heading)] mt-5 text-lg font-bold">Đã gửi lời nhắn</p>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "var(--sf-ink-soft)" }}>
          {successMessage}
        </p>
      </div>
    );
  }

  return (
    <form id={formId} action={formAction} onSubmit={onSubmit} aria-labelledby={formTitle ? titleId : undefined} aria-busy={isPending} className="relative">
      {formTitle ? (
        <h3 id={titleId} className="font-[family-name:var(--font-heading)] mb-5 text-xl font-bold">
          {formTitle}
        </h3>
      ) : null}

      <p className="mb-4 text-sm" style={{ color: "var(--sf-ink-soft)" }}>
        Vui lòng điền đủ cả 3 ô.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-name`} className="sr-only">
            Tên của bạn
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Tên của bạn"
            className={`${INPUT} h-12`}
            style={{ borderColor: "#d1d5db" }}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className="sr-only">
            Email của bạn
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            inputMode="email"
            required
            maxLength={200}
            autoComplete="email"
            placeholder="Email của bạn"
            className={`${INPUT} h-12`}
            style={{ borderColor: "#d1d5db" }}
          />
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={`${formId}-message`} className="sr-only">
          Lời nhắn
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          required
          maxLength={2000}
          rows={5}
          placeholder="Lời nhắn của bạn"
          className={`${INPUT} min-h-36 resize-y py-3 leading-relaxed`}
          style={{ borderColor: "#d1d5db" }}
        />
      </div>

      {/* Honeypot chống bot: ngoài màn hình, bị ẩn khỏi cây truy cập và thứ tự Tab. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`${formId}-website`}>Website</label>
        <input id={`${formId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-sm font-medium" style={{ background: "#fef2f2", borderColor: "#fca5a5", color: "#b91c1c" }}>
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isPending} className={`${pillClass("primary")} mt-6 w-full cursor-pointer disabled:cursor-wait disabled:opacity-70 sm:w-auto`}>
        {isPending ? (
          <>
            <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
            Đang gửi...
          </>
        ) : (
          "Gửi lời nhắn"
        )}
      </button>
    </form>
  );
}
