"use client";

import { useId, useRef, useState, useTransition } from "react";
import {
  REVIEW_HIDDEN_REASON_LABELS,
  REVIEW_REPLY_MAX_LENGTH,
  TENANT_REVIEW_HIDE_REASONS,
  type ReviewHiddenReasonValue,
  type TenantReviewHideReason,
} from "@gieochu/core/review";
import { productPath } from "@gieochu/core/product-path";
import { Badge, RowActionButton } from "../../../../admin/_ui/kit";
import { IconEyeOff, IconLock } from "../../../../admin/_ui/icons";
import { formatReviewDateTime, REVIEW_RATING_WORDS, reviewerInitial, ReviewStars } from "../../../../[tenantSlug]/_ui/review-parts";
import { hideReviewAction, replyReviewAction, unhideReviewAction, type ReviewModerationState } from "../actions";

/*
 * ADR-029 (M10a) — thẻ 1 đánh giá trong Studio → Đánh giá. Tenant chỉ: trả lời (1 trả lời, sửa/xoá được — gửi rỗng
 * = xoá), ẩn (bắt buộc chọn lý do), khôi phục. Đánh giá tự ẩn vì hoàn tiền (REFUNDED) bị khoá, có giải thích.
 * Không sửa/xoá nội dung của khách. Kết quả thao tác thông báo qua vùng `role="status"` luôn gắn sẵn.
 */

const INK = "#12213A";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const TEXTAREA_CLASS =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";
const SELECT_CLASS =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15 sm:max-w-xs";

/** Dữ liệu 1 đánh giá đã tuần tự hoá ở page (Date → ISO string). */
export interface StudioReviewCardData {
  id: string;
  productTitle: string;
  productSlug: string;
  rating: number;
  body: string | null;
  displayName: string;
  status: "VISIBLE" | "HIDDEN";
  hiddenReason: ReviewHiddenReasonValue | null;
  hiddenAt: string | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Panel = "none" | "reply" | "hide";

export function StudioReviewCard({ tenantSlug, tenantName, review }: { tenantSlug: string; tenantName: string; review: StudioReviewCardData }) {
  const uid = useId();
  const [panel, setPanel] = useState<Panel>("none");
  const [replyDraft, setReplyDraft] = useState(review.reply ?? "");
  const [reason, setReason] = useState<TenantReviewHideReason | "">("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef<HTMLElement>(null);

  const hidden = review.status === "HIDDEN";
  const refundLocked = review.hiddenReason === "REFUNDED";
  const nameId = `${uid}-name`;
  const replyId = `${uid}-reply`;
  const reasonId = `${uid}-reason`;
  const replyLength = Array.from(replyDraft).length;
  const replyTooLong = replyLength > REVIEW_REPLY_MAX_LENGTH;

  function run(action: () => Promise<ReviewModerationState>, successText: string) {
    setError(null);
    setAnnouncement("");
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setPanel("none");
        setAnnouncement(successText);
        cardRef.current?.focus();
      } else {
        setError(result.error ?? "Thao tác không thành công. Vui lòng thử lại.");
      }
    });
  }

  function saveReply() {
    if (replyTooLong) return;
    const trimmed = replyDraft.trim();
    run(() => replyReviewAction(tenantSlug, review.id, trimmed), trimmed ? "Đã lưu trả lời." : "Đã xoá trả lời.");
  }

  function deleteReply() {
    if (!window.confirm("Xoá trả lời của bạn cho đánh giá này?")) return;
    setReplyDraft("");
    run(() => replyReviewAction(tenantSlug, review.id, ""), "Đã xoá trả lời.");
  }

  function hide() {
    if (!reason) {
      setReasonError("Vui lòng chọn lý do ẩn.");
      document.getElementById(reasonId)?.focus();
      return;
    }
    run(() => hideReviewAction(tenantSlug, review.id, reason), "Đã ẩn đánh giá — khách khác không còn thấy và điểm trung bình đã được tính lại.");
  }

  return (
    <article
      ref={cardRef}
      tabIndex={-1}
      aria-labelledby={nameId}
      className="relative overflow-hidden rounded-2xl border bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B82]/30 sm:p-5"
      style={{ borderColor: hidden ? "#FDE68A" : LINE, background: hidden ? "#FFFDF5" : "white" }}
    >
      {hidden ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: "#D97706" }} /> : null}

      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: hidden ? "#6B7280" : "#0F3B82" }}
          >
            {reviewerInitial(review.displayName)}
          </span>
          <div className="min-w-0">
            <h2 id={nameId} className="flex flex-wrap items-center gap-2 break-words" style={{ color: INK }}>
              <span className="font-semibold">{review.displayName}</span>
              {hidden ? (
                <Badge tone="warning">Đã ẩn</Badge>
              ) : (
                <Badge tone="success">Đang hiển thị</Badge>
              )}
              {review.reply ? <Badge tone="info">Đã trả lời</Badge> : null}
            </h2>
            <p className="mt-0.5 text-sm break-words" style={{ color: INK_SOFT }}>
              <span className="sr-only">Tài liệu: </span>
              <a
                href={`${productPath(tenantSlug, review.productSlug)}#danh-gia`}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: INK }}
              >
                {review.productTitle}
                <span className="sr-only"> (mở trang tài liệu ở tab mới)</span>
              </a>
            </p>
          </div>
        </div>
        <p className="text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>
          <time dateTime={review.createdAt}>{formatReviewDateTime(review.createdAt)}</time>
          {review.updatedAt !== review.createdAt ? <span> · đã sửa</span> : null}
        </p>
      </header>

      <div className="mt-3 sm:pl-[52px]">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ReviewStars rating={review.rating} className="text-amber-600" />
          <span className="font-medium" style={{ color: INK }}>
            {review.rating}/5 — {REVIEW_RATING_WORDS[review.rating]}
          </span>
        </p>
        {review.body ? (
          <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-gray-900">{review.body}</p>
        ) : (
          <p className="mt-2 text-sm italic" style={{ color: INK_SOFT }}>
            Khách chỉ chấm sao, không viết nhận xét.
          </p>
        )}

        {hidden ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
            {refundLocked ? <IconLock className="mt-0.5 h-4 w-4 shrink-0" /> : <IconEyeOff className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              <strong className="font-semibold">Lý do ẩn:</strong> {review.hiddenReason ? REVIEW_HIDDEN_REASON_LABELS[review.hiddenReason] : "Không rõ"}
              {review.hiddenAt ? <> · lúc {formatReviewDateTime(review.hiddenAt)}</> : null}
              {refundLocked ? (
                <span className="mt-0.5 block">
                  Đánh giá tự ẩn vì đơn hàng được hoàn tiền / thu hồi quyền tải nên bạn không khôi phục được. Nó chỉ hiện lại nếu khách mua lại và cập nhật
                  đánh giá.
                </span>
              ) : (
                <span className="mt-0.5 block">Khách khác không thấy đánh giá này; người viết thấy nhãn “đã bị ẩn” kèm lý do.</span>
              )}
            </span>
          </p>
        ) : null}

        {review.reply && panel !== "reply" ? (
          <div className="mt-3 rounded-lg border-l-4 px-3.5 py-2.5" style={{ borderColor: "#0F3B82", background: "#E8F1FF" }}>
            <p className="text-xs font-semibold" style={{ color: "#0F3B82" }}>
              Phản hồi từ {tenantName}
              {review.repliedAt ? <span className="font-normal" style={{ color: INK_SOFT }}> · {formatReviewDateTime(review.repliedAt)}</span> : null}
            </p>
            <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color: INK }}>
              {review.reply}
            </p>
          </div>
        ) : null}

        {panel === "reply" ? (
          <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: LINE }}>
            <label htmlFor={replyId} className="block text-sm font-medium" style={{ color: INK }}>
              {review.reply ? "Sửa trả lời công khai" : "Trả lời công khai"}
            </label>
            <textarea
              id={replyId}
              rows={4}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              aria-describedby={`${replyId}-count`}
              aria-invalid={replyTooLong ? true : undefined}
              className={`${TEXTAREA_CLASS} ${replyTooLong ? "border-red-600" : ""}`}
              style={replyTooLong ? undefined : { borderColor: LINE }}
            />
            <p id={`${replyId}-count`} className={`mt-1 text-xs tabular-nums ${replyTooLong ? "font-semibold text-red-700" : ""}`} style={replyTooLong ? undefined : { color: INK_SOFT }}>
              {replyLength.toLocaleString("vi-VN")}/{REVIEW_REPLY_MAX_LENGTH.toLocaleString("vi-VN")} ký tự · hiển thị dưới đánh giá với tên “{tenantName}”. Để trống rồi lưu =
              xoá trả lời.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <RowActionButton size="touch" type="button" tone="primary" onClick={saveReply} disabled={isPending || replyTooLong}>
                {isPending ? "Đang lưu..." : "Lưu trả lời"}
              </RowActionButton>
              <RowActionButton size="touch"
                type="button"
                onClick={() => {
                  setPanel("none");
                  setReplyDraft(review.reply ?? "");
                }}
                disabled={isPending}
              >
                Huỷ
              </RowActionButton>
            </div>
          </div>
        ) : null}

        {panel === "hide" ? (
          <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}>
            <label htmlFor={reasonId} className="block text-sm font-medium" style={{ color: INK }}>
              Lý do ẩn <span aria-hidden="true">*</span>
              <span className="sr-only"> (bắt buộc)</span>
            </label>
            <select
              id={reasonId}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as TenantReviewHideReason | "");
                setReasonError(null);
              }}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? `${reasonId}-error` : `${reasonId}-hint`}
              className={SELECT_CLASS}
              style={{ borderColor: reasonError ? "#DC2626" : LINE }}
            >
              <option value="">— Chọn lý do —</option>
              {TENANT_REVIEW_HIDE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REVIEW_HIDDEN_REASON_LABELS[r]}
                </option>
              ))}
            </select>
            {reasonError ? (
              <p id={`${reasonId}-error`} role="alert" className="mt-1.5 text-sm text-red-700">
                {reasonError}
              </p>
            ) : (
              <p id={`${reasonId}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                Đánh giá bị ẩn không hiện công khai và không tính vào điểm. Người viết thấy nhãn “đã bị ẩn” kèm lý do. Bạn khôi phục được bất cứ lúc nào.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <RowActionButton size="touch" type="button" tone="danger" onClick={hide} disabled={isPending}>
                {isPending ? "Đang ẩn..." : "Ẩn đánh giá"}
              </RowActionButton>
              <RowActionButton size="touch"
                type="button"
                onClick={() => {
                  setPanel("none");
                  setReason("");
                  setReasonError(null);
                }}
                disabled={isPending}
              >
                Huỷ
              </RowActionButton>
            </div>
          </div>
        ) : null}
      </div>

      {panel === "none" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 sm:pl-[52px]" style={{ borderColor: LINE }}>
          <RowActionButton size="touch"
            type="button"
            tone="primary"
            onClick={() => {
              setAnnouncement("");
              setPanel("reply");
            }}
            disabled={isPending}
          >
            {review.reply ? "Sửa trả lời" : "Trả lời"}
          </RowActionButton>
          {review.reply ? (
            <RowActionButton size="touch" type="button" onClick={deleteReply} disabled={isPending}>
              Xoá trả lời
            </RowActionButton>
          ) : null}
          {!hidden ? (
            <RowActionButton size="touch"
              type="button"
              tone="danger"
              onClick={() => {
                setAnnouncement("");
                setPanel("hide");
              }}
              disabled={isPending}
            >
              Ẩn đánh giá
            </RowActionButton>
          ) : refundLocked ? (
            <RowActionButton size="touch" type="button" disabled aria-describedby={`${uid}-locked`}>
              <IconLock className="mr-1 h-3.5 w-3.5" /> Không thể khôi phục
            </RowActionButton>
          ) : (
            <RowActionButton size="touch"
              type="button"
              tone="success"
              onClick={() => run(() => unhideReviewAction(tenantSlug, review.id), "Đã khôi phục — đánh giá hiển thị công khai trở lại.")}
              disabled={isPending}
            >
              {isPending ? "Đang khôi phục..." : "Khôi phục"}
            </RowActionButton>
          )}
          {refundLocked ? (
            <span id={`${uid}-locked`} className="sr-only">
              Đánh giá tự ẩn vì hoàn tiền, không khôi phục được.
            </span>
          ) : null}
        </div>
      ) : null}

      <p role="status" aria-live="polite" className={announcement ? "mt-3 text-sm font-medium text-green-700 sm:pl-[52px]" : "sr-only"}>
        {announcement}
      </p>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border px-3 py-2 text-sm sm:ml-[52px]" style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C" }}>
          {error}
        </p>
      ) : null}
    </article>
  );
}
