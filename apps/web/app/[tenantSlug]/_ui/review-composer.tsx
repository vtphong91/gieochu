"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { REVIEW_BODY_MAX_LENGTH, REVIEW_HIDDEN_REASON_LABELS } from "@gieochu/core/review";
import { brandColors } from "@gieochu/config/theme";
import type { MyReview } from "../../../lib/review";
import { deleteMyReviewAction, upsertMyReviewAction, type ReviewFormState } from "../[productSlug]/review-actions";
import { IconAlertTriangle, IconEdit, IconTrash } from "../../admin/_ui/icons";
import { IconInfo, IconStar } from "./icons";
import { formatReviewDateTime, REVIEW_RATING_WORDS, ReviewStars } from "./review-parts";

/*
 * ADR-029 (M10a) — khung đánh giá của CHÍNH khách trên trang chi tiết tài liệu (trang hệ thống):
 *  - khách chưa đăng nhập: lời mời đăng nhập;
 *  - đã đăng nhập nhưng chưa đủ điều kiện, chưa có đánh giá: giải thích ngắn;
 *  - đủ điều kiện, chưa viết: form (chọn sao = nhóm radio gốc → phím mũi tên dùng được; textarea đếm ký tự; xem
 *    trước tên hiển thị); đã viết: xem đánh giá của mình + Sửa / Xoá (xác nhận), nhãn "đã bị ẩn" kèm lý do.
 * Kết quả gửi/xoá được thông báo qua 1 vùng `role="status"` luôn gắn sẵn (aria-live). Quyền thật kiểm ở server.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const SURFACE = brandColors.surface;

const CARD = "rounded-2xl border bg-white p-5 sm:p-6";
const BTN_PRIMARY =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-[color:var(--color-primary)] px-6 text-sm font-bold text-white transition-[filter] duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 motion-reduce:transition-none";
const BTN_GHOST =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border bg-white px-5 text-sm font-semibold transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";
const BTN_DANGER =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

function charCount(value: string): number {
  return Array.from(value).length;
}

export type ReviewComposerProps =
  | { viewer: "guest"; loginHref: string }
  | {
      viewer: "customer";
      productId: string;
      tenantName: string;
      canReview: boolean;
      existing: MyReview | null;
      displayNamePreview: string;
      profileHref: string;
    };

export function ReviewComposer(props: ReviewComposerProps) {
  if (props.viewer === "guest") {
    return (
      <p className={`${CARD} flex items-start gap-2.5 text-sm`} style={{ borderColor: LINE, color: INK_SOFT }}>
        <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Bạn đã mua tài liệu này?{" "}
          <a href={props.loginHref} className="font-semibold underline underline-offset-2 hover:no-underline" style={{ color: BLUE }}>
            Đăng nhập
          </a>{" "}
          để viết đánh giá.
        </span>
      </p>
    );
  }
  return <CustomerReviewPanel {...props} />;
}

function CustomerReviewPanel({
  productId,
  tenantName,
  canReview,
  existing,
  displayNamePreview,
  profileHref,
}: Extract<ReviewComposerProps, { viewer: "customer" }>) {
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  // Tăng sau mỗi lần lưu/xoá thành công → effect đưa focus về tiêu đề khung (nút bấm vừa biến mất khỏi DOM).
  const [focusTick, setFocusTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTick > 0) headingRef.current?.focus();
  }, [focusTick]);

  if (!existing && !canReview) {
    return (
      <p className={`${CARD} flex items-start gap-2.5 text-sm`} style={{ borderColor: LINE, color: INK_SOFT }}>
        <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
        Chỉ khách đã mua và đang sở hữu tài liệu này mới viết được đánh giá.
      </p>
    );
  }

  const showForm = canReview && (!existing || editing);

  function handleSaved(result: ReviewFormState) {
    setEditing(false);
    setAnnouncement(result.created ? "Cảm ơn bạn! Đánh giá đã được đăng." : "Đã lưu thay đổi đánh giá của bạn.");
    setFocusTick((n) => n + 1);
  }

  function handleDelete(reviewId: string) {
    if (!window.confirm("Xoá đánh giá của bạn? Thao tác này không hoàn tác được.")) return;
    setDeleteError(null);
    setAnnouncement("");
    startDelete(async () => {
      const result = await deleteMyReviewAction(reviewId);
      if (result.success) {
        setEditing(false);
        setAnnouncement("Đã xoá đánh giá của bạn.");
        setFocusTick((n) => n + 1);
      } else {
        setDeleteError(result.error ?? "Không xoá được đánh giá. Vui lòng thử lại.");
      }
    });
  }

  const title = showForm ? (existing ? "Sửa đánh giá của bạn" : "Viết đánh giá của bạn") : "Đánh giá của bạn";

  return (
    <div className={CARD} style={{ borderColor: LINE }}>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="font-[family-name:var(--font-heading)] text-lg font-bold outline-none"
        style={{ color: INK }}
      >
        {title}
      </h3>

      {/* Luôn gắn sẵn để trình đọc màn hình nghe được kết quả gửi/sửa/xoá. */}
      <p role="status" aria-live="polite" className={announcement ? "mt-3 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800" : "sr-only"}>
        {announcement}
      </p>

      {showForm ? (
        <ReviewForm
          key={existing?.updatedAt ? new Date(existing.updatedAt).getTime() : "new"}
          productId={productId}
          existing={existing}
          displayNamePreview={displayNamePreview}
          profileHref={profileHref}
          onSaved={handleSaved}
          onCancel={
            existing
              ? () => {
                  setEditing(false);
                  setFocusTick((n) => n + 1);
                }
              : undefined
          }
        />
      ) : existing ? (
        <div className="mt-4">
          {existing.status === "HIDDEN" ? (
            <p className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="font-semibold">Đánh giá của bạn đã bị ẩn</strong>
                {existing.hiddenReason ? ` — ${REVIEW_HIDDEN_REASON_LABELS[existing.hiddenReason]}` : ""}. Khách khác không thấy đánh giá này và nó không
                được tính vào điểm trung bình.
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
            <ReviewStars rating={existing.rating} className="text-[color:var(--color-accent)]" starClassName="h-5 w-5" />
            <span className="font-semibold" style={{ color: INK }}>
              {REVIEW_RATING_WORDS[existing.rating]}
            </span>
            <span>
              Đăng với tên <strong className="font-semibold" style={{ color: INK }}>{existing.displayName}</strong>
            </span>
          </div>
          {existing.body ? (
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK }}>
              {existing.body}
            </p>
          ) : (
            <p className="mt-3 text-sm italic" style={{ color: INK_SOFT }}>
              Bạn chưa viết nội dung — chỉ chấm sao.
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: INK_SOFT }}>
            {existing.updatedAt && new Date(existing.updatedAt).getTime() !== new Date(existing.createdAt).getTime() ? "Cập nhật lúc " : "Đăng lúc "}
            <time dateTime={new Date(existing.updatedAt).toISOString()}>{formatReviewDateTime(existing.updatedAt)}</time>
          </p>

          {existing.reply ? (
            <div className="mt-3 rounded-xl border-l-4 px-4 py-3" style={{ borderColor: BLUE, background: SURFACE }}>
              <p className="text-sm font-semibold" style={{ color: BLUE }}>
                Phản hồi từ {tenantName}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK }}>
                {existing.reply}
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {canReview ? (
              <button
                type="button"
                className={BTN_GHOST}
                style={{ borderColor: LINE, color: INK }}
                onClick={() => {
                  setAnnouncement("");
                  setEditing(true);
                }}
                disabled={isDeleting}
              >
                <IconEdit className="h-4 w-4" /> Sửa đánh giá
              </button>
            ) : null}
            <button type="button" className={BTN_DANGER} onClick={() => handleDelete(existing.id)} disabled={isDeleting}>
              <IconTrash className="h-4 w-4" /> {isDeleting ? "Đang xoá..." : "Xoá đánh giá"}
            </button>
          </div>
          {!canReview ? (
            <p className="mt-3 text-xs" style={{ color: INK_SOFT }}>
              Bạn không còn quyền sở hữu tài liệu này nên không sửa được đánh giá, nhưng vẫn có thể xoá.
            </p>
          ) : null}
          {deleteError ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReviewForm({
  productId,
  existing,
  displayNamePreview,
  profileHref,
  onSaved,
  onCancel,
}: {
  productId: string;
  existing: MyReview | null;
  displayNamePreview: string;
  profileHref: string;
  onSaved: (result: ReviewFormState) => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [rating, setRating] = useState<number>(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(async (prev: ReviewFormState | null, formData: FormData) => {
    const result = await upsertMyReviewAction(productId, prev, formData);
    if (result.success) onSaved(result);
    return result;
  }, null);

  const length = charCount(body);
  const tooLong = length > REVIEW_BODY_MAX_LENGTH;
  const nearLimit = length > REVIEW_BODY_MAX_LENGTH * 0.9;
  const bodyId = `${uid}-body`;
  const counterId = `${uid}-counter`;
  const ratingErrorId = `${uid}-rating-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (rating < 1) {
      event.preventDefault();
      setRatingError("Vui lòng chọn số sao từ 1 đến 5.");
      firstRadioRef.current?.focus();
      return;
    }
    if (tooLong) {
      event.preventDefault();
      document.getElementById(bodyId)?.focus();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="mt-4 space-y-5">
      <fieldset aria-describedby={ratingError ? ratingErrorId : undefined}>
        <legend className="text-sm font-semibold" style={{ color: INK }}>
          Số sao <span aria-hidden="true">*</span>
          <span className="sr-only"> (bắt buộc)</span>
        </legend>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Nhóm radio gốc: Tab vào nhóm, phím mũi tên đổi số sao. Sao ≤ số đã chọn được tô. */}
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-[color:var(--color-accent)] transition-transform duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-[color:var(--color-primary)] motion-safe:hover:scale-110 motion-reduce:transition-none"
              >
                <input
                  ref={n === 1 ? firstRadioRef : undefined}
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => {
                    setRating(n);
                    setRatingError(null);
                  }}
                  className="peer sr-only"
                />
                <span className="sr-only">
                  {n} sao — {REVIEW_RATING_WORDS[n]}
                </span>
                <IconStar filled={n <= rating} className="h-8 w-8" />
              </label>
            ))}
          </div>
          <span className="text-sm font-medium" style={{ color: rating ? INK : INK_SOFT }} aria-hidden="true">
            {rating ? `${rating}/5 — ${REVIEW_RATING_WORDS[rating]}` : "Chưa chọn"}
          </span>
        </div>
        {ratingError ? (
          <p id={ratingErrorId} role="alert" className="mt-1.5 text-sm text-red-700">
            {ratingError}
          </p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor={bodyId} className="block text-sm font-semibold" style={{ color: INK }}>
          Nhận xét của bạn <span className="font-normal" style={{ color: INK_SOFT }}>(tuỳ chọn)</span>
        </label>
        <textarea
          id={bodyId}
          name="body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby={counterId}
          aria-invalid={tooLong ? true : undefined}
          placeholder="Tài liệu giúp gì cho bạn? Điều gì bạn thích hoặc mong được cải thiện?"
          className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-base leading-relaxed outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/15 ${tooLong ? "border-red-700" : ""}`}
          style={{ ...(tooLong ? {} : { borderColor: LINE }), color: INK }}
        />
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs">
          <span style={{ color: INK_SOFT }}>Chỉ văn bản thuần — xuống dòng được giữ nguyên.</span>
          <span id={counterId} className={`tabular-nums ${tooLong ? "font-semibold text-red-700" : ""}`} style={tooLong ? undefined : { color: INK_SOFT }}>
            {length.toLocaleString("vi-VN")}/{REVIEW_BODY_MAX_LENGTH.toLocaleString("vi-VN")} ký tự
            {tooLong ? ` — vượt ${(length - REVIEW_BODY_MAX_LENGTH).toLocaleString("vi-VN")} ký tự` : ""}
          </span>
        </div>
        {/* Chỉ báo cho trình đọc màn hình khi gần/vượt giới hạn — không đọc từng lần gõ. */}
        <p className="sr-only" aria-live="polite">
          {tooLong ? `Nhận xét vượt giới hạn ${REVIEW_BODY_MAX_LENGTH} ký tự.` : nearLimit ? `Còn ${REVIEW_BODY_MAX_LENGTH - length} ký tự.` : ""}
        </p>
      </div>

      <p className="rounded-xl px-4 py-3 text-sm" style={{ background: SURFACE, color: INK }}>
        Tên hiển thị công khai: <strong className="font-semibold">{displayNamePreview}</strong>
        <span className="mt-0.5 block text-xs" style={{ color: INK_SOFT }}>
          Lấy từ họ tên trong{" "}
          <a href={profileHref} className="font-semibold underline underline-offset-2 hover:no-underline" style={{ color: BLUE }}>
            hồ sơ của bạn
          </a>
          . Email không bao giờ được hiển thị.
        </span>
      </p>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={isPending}>
          {isPending ? "Đang gửi..." : existing ? "Lưu thay đổi" : "Gửi đánh giá"}
        </button>
        {onCancel ? (
          <button type="button" className={BTN_GHOST} style={{ borderColor: LINE, color: INK }} onClick={onCancel} disabled={isPending}>
            Huỷ
          </button>
        ) : null}
      </div>
    </form>
  );
}
