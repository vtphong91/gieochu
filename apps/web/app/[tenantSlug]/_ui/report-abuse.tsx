"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import {
  ABUSE_REPORT_DESCRIPTION_MAX_LENGTH,
  ABUSE_REPORT_ERROR_CODES,
  ABUSE_REPORT_EVIDENCE_MAX,
  ABUSE_REPORT_HONEYPOT_FIELD,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_REPORT_TYPES,
  codePointLength,
  normalizeEvidenceUrl,
  type AbuseReportTypeValue,
  type AbuseTargetTypeValue,
} from "@gieochu/core/abuse-report";
import { IconAlertTriangle, IconCheckCircle, IconClose, IconFlag, IconPlus, IconShield, IconTrash } from "../../admin/_ui/icons";

/*
 * ADR-038 (M12c) — nút "Báo cáo vi phạm" phía công khai + hộp thoại gửi báo cáo (trang chi tiết tài liệu, từng đánh giá,
 * trang bài viết — trang hệ thống ADR-025: màu + font hệ thống).
 *
 * Hộp thoại dùng `<dialog>` gốc mở bằng `showModal()` (top layer — không lo z-index, nền phía sau trơ `inert`), kèm:
 * `aria-modal`, `aria-labelledby/-describedby`, bẫy Tab vòng trong hộp thoại, Esc / nút Đóng / bấm nền mờ để đóng
 * (đang gửi thì không đóng), trả focus về nút đã mở. Gửi `fetch("/api/reports")` JSON cùng origin; lỗi API
 * `{ error: { code, message, requestId } }` được đổi thành thông điệp tiếng Việt theo mã, lỗi theo trường hiện ngay dưới ô.
 * Không dùng `localStorage`; email chỉ gửi khi khách chưa đăng nhập (server tự lấy email tài khoản nếu đã đăng nhập).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const SURFACE = brandColors.surface;
const RED = "#B91C1C"; // 6.5:1 trên nền trắng
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";
const GREEN = "#15803D"; // 5.0:1 trên nền trắng

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const FIELD =
  "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-base outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/15 motion-reduce:transition-none sm:text-[15px]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`;

/** Gợi ý ngắn dưới từng loại vi phạm — giúp người báo cáo chọn đúng loại. */
const TYPE_HINTS: Record<AbuseReportTypeValue, string> = {
  COPYRIGHT: "Sao chép hoặc phân phối tài liệu của bạn hay của người khác khi chưa được phép.",
  INAPPROPRIATE: "Nội dung phản cảm, xúc phạm hoặc không phù hợp với người học.",
  SCAM: "Thông tin gian dối, mạo danh hoặc dụ dỗ chuyển tiền.",
  OTHER: "Vi phạm không thuộc các loại trên — mô tả rõ ở ô bên dưới.",
};

const ERROR_TEXT = {
  network: "Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.",
  duplicate: "Bạn đã báo cáo nội dung này và báo cáo vẫn đang chờ xử lý. Chúng tôi sẽ phản hồi qua email khi có kết quả.",
  rateLimited: "Bạn đã gửi quá nhiều báo cáo trong một giờ qua. Vui lòng thử lại sau.",
  notFound: "Nội dung này không còn hiển thị công khai nên không thể báo cáo nữa. Hãy tải lại trang.",
  unavailable: "Chức năng báo cáo tạm thời chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.",
  generic: "Chưa gửi được báo cáo. Vui lòng thử lại.",
  invalid: "Vui lòng kiểm tra lại các mục được đánh dấu.",
} as const;

const DEFAULT_SUCCESS = "Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét và phản hồi qua email.";

type FieldKey = "type" | "description" | "evidence" | "email";
type FieldErrors = Partial<Record<FieldKey, string>>;
type EvidenceRow = { key: number; value: string };

interface ApiErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}

/** VALIDATION_ERROR chỉ trả thông điệp của lỗi đầu tiên (schema core) — đoán trường theo nội dung để hiện cạnh ô. */
function fieldFromValidationMessage(message: string): FieldKey | null {
  const m = message.toLowerCase();
  if (m.includes("email")) return "email";
  if (m.includes("link")) return "evidence";
  if (m.includes("loại vi phạm")) return "type";
  if (m.includes("mô tả")) return "description";
  return null;
}

/** Bản sao object bỏ 1 khoá (xoá lỗi của 1 ô khi người dùng sửa). */
function omitKey<T extends object>(source: T, key: PropertyKey): T {
  const copy = { ...source } as Record<PropertyKey, unknown>;
  delete copy[key];
  return copy as T;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';

export interface ReportAbuseButtonProps {
  targetType: AbuseTargetTypeValue;
  targetId: string;
  /** Mô tả đối tượng hiện trong hộp thoại, ví dụ `Tài liệu “Bộ đề Toán 9”`. */
  targetLabel: string;
  /** Server Component truyền xuống: đã đăng nhập thì không hỏi email. */
  isSignedIn: boolean;
  /** Chữ trên nút (mặc định "Báo cáo vi phạm"). */
  label?: string;
  /** Phần chữ ẩn bổ sung cho tên truy cập khi trên trang có nhiều nút cùng chữ (ví dụ " đánh giá của Minh N."). */
  srContext?: string;
  className?: string;
}

export function ReportAbuseButton({ targetType, targetId, targetLabel, isSignedIn, label = "Báo cáo vi phạm", srContext, className = "" }: ReportAbuseButtonProps) {
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    desc: `${uid}-desc`,
    type: `${uid}-type`,
    description: `${uid}-description`,
    evidence: `${uid}-evidence`,
    email: `${uid}-email`,
    honeypot: `${uid}-hp`,
    formError: `${uid}-form-error`,
  };

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(1);

  /**
   * Nội dung hộp thoại chỉ dựng từ lần mở đầu tiên — trang tài liệu có tới 50 đánh giá, mỗi đánh giá một nút báo cáo;
   * không dựng sẵn 50 form ẩn trong DOM.
   */
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"form" | "success">("form");
  const [type, setType] = useState<AbuseReportTypeValue | "">("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<EvidenceRow[]>([{ key: 0, value: "" }]);
  const [email, setEmail] = useState("");
  const [emailRequired, setEmailRequired] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<{ text: string; requestId?: string } | null>(null);
  const [successText, setSuccessText] = useState(DEFAULT_SUCCESS);
  const [submitting, setSubmitting] = useState(false);
  /** id phần tử cần nhận focus sau lần render kế tiếp (lỗi/ô email/ô link vừa xuất hiện) — luôn đi kèm 1 setState. */
  const pendingFocus = useRef<string | null>(null);

  const showEmail = !isSignedIn || emailRequired;
  const descriptionLength = codePointLength(description);
  const descriptionTooLong = descriptionLength > ABUSE_REPORT_DESCRIPTION_MAX_LENGTH;

  // Chạy sau mỗi lần render: phần tử đích lúc này đã có trong DOM.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    document.getElementById(id)?.focus();
  });

  function setFocusTarget(id: string) {
    pendingFocus.current = id;
  }

  function resetForm() {
    setPhase("form");
    setType("");
    setDescription("");
    setRows([{ key: nextKey.current++, value: "" }]);
    setEmail("");
    setEmailRequired(false);
    setErrors({});
    setRowErrors({});
    setFormError(null);
    setSuccessText(DEFAULT_SUCCESS);
  }

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // Focus vào tiêu đề: trình đọc màn hình đọc tên + mô tả hộp thoại, Tab kế tiếp tới nút Đóng rồi các ô.
    if (mounted) {
      titleRef.current?.focus();
    } else {
      // Lần mở đầu: nội dung mới được dựng ở lần render kế tiếp → focus sau render.
      setMounted(true);
      setFocusTarget(ids.title);
    }
  }

  function close() {
    if (submitting) return;
    dialogRef.current?.close();
  }

  /** Sự kiện `close` của <dialog> (nút Đóng, Esc, bấm nền) — trả focus về nút mở; đã gửi xong thì xoá form. */
  function handleClosed() {
    if (phase === "success") resetForm();
    triggerRef.current?.focus();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc khi đang gửi: giữ hộp thoại để người dùng thấy kết quả.
    if (submitting) event.preventDefault();
  }

  /** Bấm vào vùng nền mờ (chính phần tử <dialog>, ngoài khung nội dung) → đóng. */
  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) close();
  }

  /** Bẫy Tab: phần tử cuối → đầu và ngược lại (nền đã `inert`, chặn thêm việc Tab ra thanh địa chỉ trình duyệt). */
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !items.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateRow(key: number, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, value } : row)));
    if (rowErrors[key]) setRowErrors((current) => omitKey(current, key));
  }

  function addRow() {
    if (rows.length >= ABUSE_REPORT_EVIDENCE_MAX) return;
    const key = nextKey.current++;
    setRows((current) => [...current, { key, value: "" }]);
    setFocusTarget(`${ids.evidence}-${key}`);
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (!row) return;
    const remaining = rows.filter((r) => r.key !== row.key);
    const next = remaining.length > 0 ? remaining : [{ key: nextKey.current++, value: "" }];
    setRows(next);
    setRowErrors((current) => omitKey(current, row.key));
    // Focus về ô liền trước (hoặc ô trống mới) — nút vừa bấm biến mất khỏi DOM.
    const neighbour = next[Math.max(0, Math.min(index - 1, next.length - 1))]!;
    setFocusTarget(`${ids.evidence}-${neighbour.key}`);
  }

  /** Kiểm tra phía trình duyệt (server vẫn kiểm lại). Trả id phần tử lỗi đầu tiên hoặc null. */
  function validate(): string | null {
    const nextErrors: FieldErrors = {};
    const nextRowErrors: Record<number, string> = {};
    let firstInvalid: string | null = null;
    const mark = (id: string) => {
      if (!firstInvalid) firstInvalid = id;
    };

    if (!type) {
      nextErrors.type = "Vui lòng chọn loại vi phạm.";
      mark(`${ids.type}-${ABUSE_REPORT_TYPES[0]}`);
    }
    if (description.trim() === "") {
      nextErrors.description = "Vui lòng mô tả vi phạm.";
      mark(ids.description);
    } else if (descriptionTooLong) {
      nextErrors.description = `Mô tả tối đa ${ABUSE_REPORT_DESCRIPTION_MAX_LENGTH.toLocaleString("vi-VN")} ký tự.`;
      mark(ids.description);
    }
    for (const row of rows) {
      if (row.value.trim() !== "" && !normalizeEvidenceUrl(row.value)) {
        nextRowErrors[row.key] = "Link phải là địa chỉ web đầy đủ, bắt đầu bằng http:// hoặc https://.";
        mark(`${ids.evidence}-${row.key}`);
      }
    }
    if (showEmail) {
      const value = email.trim();
      if (value === "") {
        nextErrors.email = "Vui lòng nhập email để chúng tôi báo kết quả xử lý.";
        mark(ids.email);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors.email = "Email không hợp lệ.";
        mark(ids.email);
      }
    }
    setErrors(nextErrors);
    setRowErrors(nextRowErrors);
    return firstInvalid;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const firstInvalid = validate();
    if (firstInvalid) {
      setFocusTarget(firstInvalid);
      return;
    }

    const honeypot = honeypotRef.current?.value ?? "";
    const payload: Record<string, unknown> = {
      targetType,
      targetId,
      type,
      description,
      evidenceUrls: rows.map((row) => row.value.trim()).filter(Boolean),
      ...(showEmail ? { email: email.trim() } : {}),
      ...(honeypot ? { [ABUSE_REPORT_HONEYPOT_FIELD]: honeypot } : {}),
    };

    setSubmitting(true);
    let response: Response;
    try {
      response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSubmitting(false);
      setFormError({ text: ERROR_TEXT.network });
      setFocusTarget(ids.formError);
      return;
    }

    let data: (ApiErrorBody & { ok?: boolean; message?: string }) | null = null;
    try {
      data = (await response.json()) as ApiErrorBody & { ok?: boolean; message?: string };
    } catch {
      data = null;
    }
    setSubmitting(false);

    if (response.ok) {
      setSuccessText(data?.message || DEFAULT_SUCCESS);
      setPhase("success");
      setFocusTarget(`${uid}-success`);
      return;
    }

    const code = data?.error?.code ?? "";
    const message = data?.error?.message ?? "";
    const requestId = data?.error?.requestId;

    if (code === ABUSE_REPORT_ERROR_CODES.EMAIL_REQUIRED) {
      setEmailRequired(true);
      setErrors((current) => ({ ...current, email: message || "Vui lòng nhập email để chúng tôi báo kết quả xử lý." }));
      setFocusTarget(ids.email);
      return;
    }
    if (code === "VALIDATION_ERROR") {
      const field = fieldFromValidationMessage(message);
      if (field) {
        setErrors((current) => ({ ...current, [field]: message }));
        setFormError({ text: ERROR_TEXT.invalid });
        setFocusTarget(
          field === "type"
            ? `${ids.type}-${ABUSE_REPORT_TYPES[0]}`
            : field === "evidence"
              ? `${ids.evidence}-${rows[0]?.key ?? 0}`
              : field === "email"
                ? ids.email
                : ids.description,
        );
        return;
      }
      setFormError({ text: message || ERROR_TEXT.invalid, requestId });
      setFocusTarget(ids.formError);
      return;
    }

    let text: string;
    if (code === ABUSE_REPORT_ERROR_CODES.DUPLICATE || response.status === 409) text = ERROR_TEXT.duplicate;
    else if (code === "RATE_LIMITED" || response.status === 429) text = ERROR_TEXT.rateLimited;
    else if (code === ABUSE_REPORT_ERROR_CODES.TARGET_NOT_FOUND || response.status === 404) text = ERROR_TEXT.notFound;
    else if (code === ABUSE_REPORT_ERROR_CODES.UNAVAILABLE || response.status === 503) text = ERROR_TEXT.unavailable;
    else text = message || ERROR_TEXT.generic;
    setFormError({ text, requestId });
    setFocusTarget(ids.formError);
  }

  const descriptionDescribedBy = [errors.description ? `${ids.description}-error` : `${ids.description}-hint`, `${ids.description}-count`].join(" ");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium underline-offset-2 transition-colors hover:text-[color:var(--color-primary)] hover:underline motion-reduce:transition-none lg:min-h-9 ${FOCUS} ${className}`}
        style={{ color: INK_SOFT }}
      >
        <IconFlag className="h-4 w-4 shrink-0" />
        {label}
        {srContext ? <span className="sr-only">{srContext}</span> : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.desc}
        onClose={handleClosed}
        onCancel={handleCancel}
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
        // Preflight đặt margin 0 cho mọi phần tử → tự căn giữa lại bằng m-auto. Không đặt `flex` trên <dialog> (sẽ đè
        // display:none khi đóng) — bố cục nằm ở khung con.
        className="m-auto w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] backdrop:bg-[rgba(18,33,58,0.55)]"
        style={{ color: INK }}
      >
        {mounted ? (
          <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
            <header className="flex items-start gap-3 border-b px-5 pt-4 pb-3 sm:px-6" style={{ borderColor: LINE }}>
              <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: SURFACE, color: BLUE }}>
                <IconFlag className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 ref={titleRef} id={ids.title} tabIndex={-1} className="font-[family-name:var(--font-heading)] text-lg leading-snug font-bold outline-none">
                  Báo cáo vi phạm
                </h2>
                <p id={ids.desc} className="mt-0.5 text-sm [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                  {targetLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                aria-label="Đóng hộp thoại báo cáo"
                className={`-mt-1 -mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}
                style={{ color: INK_SOFT }}
              >
                <IconClose className="h-5 w-5" />
              </button>
            </header>

            {phase === "success" ? (
              <div className="px-5 py-6 sm:px-6">
                <div
                    id={`${uid}-success`}
                  tabIndex={-1}
                  role="status"
                  className="flex items-start gap-3 rounded-xl border border-l-4 p-4 text-sm outline-none"
                  style={{ borderColor: brandColors.secondary, background: `color-mix(in srgb, ${brandColors.secondary} 8%, white)` }}
                >
                  <span className="mt-0.5 shrink-0" style={{ color: GREEN }}>
                    <IconCheckCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">Đã gửi báo cáo.</p>
                    <p className="mt-1 leading-relaxed">{successText}</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button type="button" onClick={close} className={`${BTN} w-full text-white hover:brightness-110 sm:w-auto`} style={{ background: BLUE }}>
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} noValidate aria-busy={submitting || undefined} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                  {formError ? (
                    <div
                      id={ids.formError}
                      tabIndex={-1}
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm outline-none"
                      style={{ background: RED_SOFT, borderColor: RED_LINE, color: RED }}
                    >
                      <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p>{formError.text}</p>
                        {formError.requestId ? (
                          <p className="mt-1 text-xs [overflow-wrap:anywhere]">
                            Mã tra cứu: <span className="font-mono">{formError.requestId}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <fieldset aria-describedby={errors.type ? `${ids.type}-error` : undefined}>
                    <legend className="text-sm font-semibold">
                      Loại vi phạm <span aria-hidden="true" style={{ color: RED }}>*</span>
                      <span className="sr-only"> (bắt buộc)</span>
                    </legend>
                    <div className="mt-2 grid gap-2">
                      {ABUSE_REPORT_TYPES.map((value) => {
                        const checked = type === value;
                        const inputId = `${ids.type}-${value}`;
                        return (
                          <label
                            key={value}
                            htmlFor={inputId}
                            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-primary)] motion-reduce:transition-none"
                            style={{ borderColor: checked ? BLUE : errors.type ? RED_LINE : LINE, background: checked ? SURFACE : "#FFFFFF" }}
                          >
                            <input
                              id={inputId}
                              type="radio"
                              name="type"
                              value={value}
                              checked={checked}
                              onChange={() => {
                                setType(value);
                                if (errors.type) setErrors((current) => omitKey(current, "type"));
                              }}
                              aria-describedby={`${inputId}-hint`}
                              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{ABUSE_REPORT_TYPE_LABELS[value]}</span>
                              <span id={`${inputId}-hint`} className="mt-0.5 block text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                                {TYPE_HINTS[value]}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.type ? (
                      <p id={`${ids.type}-error`} className="mt-1.5 text-sm" style={{ color: RED }}>
                        {errors.type}
                      </p>
                    ) : null}
                  </fieldset>

                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={ids.description} className="text-sm font-semibold">
                        Mô tả vi phạm <span aria-hidden="true" style={{ color: RED }}>*</span>
                        <span className="sr-only"> (bắt buộc)</span>
                      </label>
                      <span
                        id={`${ids.description}-count`}
                        className="shrink-0 text-xs tabular-nums"
                        style={{ color: descriptionTooLong ? RED : INK_SOFT, fontWeight: descriptionTooLong ? 600 : undefined }}
                      >
                        {descriptionLength.toLocaleString("vi-VN")}/{ABUSE_REPORT_DESCRIPTION_MAX_LENGTH.toLocaleString("vi-VN")}
                        <span className="sr-only"> ký tự</span>
                      </span>
                    </div>
                    <textarea
                      id={ids.description}
                      name="description"
                      rows={4}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (errors.description) setErrors((current) => omitKey(current, "description"));
                      }}
                      required
                      aria-required="true"
                      aria-invalid={errors.description ? true : undefined}
                      aria-describedby={descriptionDescribedBy}
                      className={`${FIELD} mt-1.5 resize-y leading-relaxed`}
                      style={{ borderColor: errors.description ? RED : LINE }}
                    />
                    {errors.description ? (
                      <p id={`${ids.description}-error`} className="mt-1.5 text-sm" style={{ color: RED }}>
                        {errors.description}
                      </p>
                    ) : (
                      <p id={`${ids.description}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                        Nêu rõ phần nào vi phạm và vì sao. Ví dụ: “Trang 3–10 sao chép từ sách … của tôi”.
                      </p>
                    )}
                  </div>

                  <fieldset aria-describedby={`${ids.evidence}-hint${errors.evidence ? ` ${ids.evidence}-error` : ""}`}>
                    <legend className="text-sm font-semibold">
                      Link bằng chứng <span className="font-normal" style={{ color: INK_SOFT }}>(tuỳ chọn)</span>
                    </legend>
                    <p id={`${ids.evidence}-hint`} className="mt-0.5 text-xs" style={{ color: INK_SOFT }}>
                      Tối đa {ABUSE_REPORT_EVIDENCE_MAX} link, ví dụ bản gốc hoặc ảnh chụp màn hình đã tải lên mạng.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {rows.map((row, index) => {
                        const inputId = `${ids.evidence}-${row.key}`;
                        const rowError = rowErrors[row.key];
                        return (
                          <li key={row.key}>
                            <div className="flex items-center gap-2">
                              <label htmlFor={inputId} className="sr-only">
                                Link bằng chứng {index + 1}
                              </label>
                              <input
                                id={inputId}
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                placeholder="https://"
                                value={row.value}
                                onChange={(e) => updateRow(row.key, e.target.value)}
                                aria-invalid={rowError ? true : undefined}
                                aria-describedby={rowError ? `${inputId}-error` : undefined}
                                className={`${FIELD} min-w-0 flex-1`}
                                style={{ borderColor: rowError ? RED : LINE }}
                              />
                              {rows.length > 1 || row.value !== "" ? (
                                <button
                                  type="button"
                                  onClick={() => removeRow(index)}
                                  aria-label={`Xoá link bằng chứng ${index + 1}`}
                                  className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:bg-red-50 motion-reduce:transition-none ${FOCUS}`}
                                  style={{ borderColor: LINE, color: RED }}
                                >
                                  <IconTrash className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                            {rowError ? (
                              <p id={`${inputId}-error`} className="mt-1 text-sm" style={{ color: RED }}>
                                {rowError}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {rows.length < ABUSE_REPORT_EVIDENCE_MAX ? (
                      <button
                        id={`${ids.evidence}-add`}
                        type="button"
                        onClick={addRow}
                        className={`mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-sm font-semibold hover:underline ${FOCUS}`}
                        style={{ color: BLUE }}
                      >
                        <IconPlus className="h-4 w-4" />
                        Thêm link
                      </button>
                    ) : (
                      <p className="mt-2 text-xs" style={{ color: INK_SOFT }}>
                        Đã đủ {ABUSE_REPORT_EVIDENCE_MAX} link.
                      </p>
                    )}
                    {errors.evidence ? (
                      <p id={`${ids.evidence}-error`} className="mt-1.5 text-sm" style={{ color: RED }}>
                        {errors.evidence}
                      </p>
                    ) : null}
                  </fieldset>

                  {showEmail ? (
                    <div>
                      <label htmlFor={ids.email} className="text-sm font-semibold">
                        Email của bạn <span aria-hidden="true" style={{ color: RED }}>*</span>
                        <span className="sr-only"> (bắt buộc)</span>
                      </label>
                      <input
                        id={ids.email}
                        type="email"
                        name="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((current) => omitKey(current, "email"));
                        }}
                        required
                        aria-required="true"
                        aria-invalid={errors.email ? true : undefined}
                        aria-describedby={errors.email ? `${ids.email}-error` : `${ids.email}-hint`}
                        className={`${FIELD} mt-1.5`}
                        style={{ borderColor: errors.email ? RED : LINE }}
                      />
                      {errors.email ? (
                        <p id={`${ids.email}-error`} className="mt-1.5 text-sm" style={{ color: RED }}>
                          {errors.email}
                        </p>
                      ) : (
                        <p id={`${ids.email}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                          Chỉ dùng để báo kết quả xử lý cho bạn.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Ô bẫy bot (honeypot): ngoài màn hình, khỏi thứ tự Tab và cây truy cập; người thật để trống. */}
                  <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                    <label htmlFor={ids.honeypot}>Website</label>
                    <input ref={honeypotRef} id={ids.honeypot} type="text" name={ABUSE_REPORT_HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
                  </div>

                  <p className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs leading-relaxed" style={{ background: SURFACE, color: INK }}>
                    <IconShield className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Danh tính và email của bạn được giữ <strong className="font-semibold">ẩn danh với chủ gian hàng</strong> — chỉ quản trị viên hệ thống
                      thấy để xử lý báo cáo.
                    </span>
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end sm:px-6" style={{ borderColor: LINE }}>
                  <button type="button" onClick={close} disabled={submitting} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
                    Huỷ
                  </button>
                  <button type="submit" disabled={submitting} className={`${BTN} text-white hover:brightness-110`} style={{ background: BLUE }}>
                    {submitting ? "Đang gửi…" : "Gửi báo cáo"}
                  </button>
                </div>
                <p role="status" aria-live="polite" className="sr-only">
                  {submitting ? "Đang gửi báo cáo…" : ""}
                </p>
              </form>
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
