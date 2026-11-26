"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import {
  ABUSE_REPORT_DECISION_LABELS,
  ABUSE_REPORT_NOTE_MAX_LENGTH,
  type AbuseReportDecisionValue,
  type AbuseTargetTypeValue,
} from "@gieochu/core/abuse-report";
import { FormBanner } from "../../_ui/kit";
import { IconMail, IconUnlock } from "../../_ui/icons";
import { resolveReportAction, unlockModerationAction, type ReportActionState } from "../actions";

/*
 * ADR-038 mục 5 — form xử lý 1 báo cáo + nút gỡ khoá kiểm duyệt (System Center). Gửi qua `useActionState` nhưng submit
 * thủ công (`startTransition`) để React không reset form khi server trả lỗi. Quyết định là nhóm radio dạng thẻ (vùng
 * bấm ≥ 44px, mô tả hậu quả ngay dưới nhãn); "Khoá gian hàng" phải xác nhận trước khi gửi.
 */

const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const RED = "#B91C1C";
const RED_LINE = "#FCA5A5";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

const TARGET_NOUN: Record<AbuseTargetTypeValue, string> = { PRODUCT: "tài liệu", REVIEW: "đánh giá", POST: "bài viết" };

function decisionHint(decision: AbuseReportDecisionValue, target: AbuseTargetTypeValue): string {
  switch (decision) {
    case "HIDE_CONTENT":
      return `Ẩn ${TARGET_NOUN[target]} khỏi trang công khai và khoá kiểm duyệt — gian hàng không tự bỏ ẩn được cho tới khi bạn gỡ khoá.`;
    case "ARCHIVE_PRODUCT":
      return "Lưu trữ tài liệu (gỡ khỏi trang bán) và khoá kiểm duyệt — gian hàng không tự xuất bản lại được. Khách đã mua vẫn giữ quyền tải.";
    case "LOCK_TENANT":
      return "Khoá toàn bộ gian hàng: trang bán ngừng hiển thị, chủ gian hàng không thao tác được. Dùng cho vi phạm nghiêm trọng hoặc lặp lại.";
    case "REJECT":
      return "Không có vi phạm — đóng báo cáo, không áp biện pháp nào với gian hàng.";
  }
}

export function ResolveReportForm({
  reportId,
  targetType,
  tenantName,
  allowedDecisions,
  otherOpenReports,
}: {
  reportId: string;
  targetType: AbuseTargetTypeValue;
  tenantName: string;
  allowedDecisions: AbuseReportDecisionValue[];
  otherOpenReports: number;
}) {
  const uid = useId();
  const [state, formAction, pending] = useActionState<ReportActionState, FormData>(resolveReportAction.bind(null, reportId), {});
  const [, startTransition] = useTransition();
  const [decision, setDecision] = useState<AbuseReportDecisionValue | "">("");
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const noteLength = Array.from(note).length;
  const noteTooLong = noteLength > ABUSE_REPORT_NOTE_MAX_LENGTH;
  const firstRadioId = `${uid}-decision-${allowedDecisions[0] ?? "none"}`;

  // Lỗi từ server → đưa focus tới thông báo lỗi (đọc ngay, không phải dò lại form).
  useEffect(() => {
    if (state.error) bannerRef.current?.focus();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!decision) {
      setDecisionError("Vui lòng chọn quyết định.");
      document.getElementById(firstRadioId)?.focus();
      return;
    }
    if (noteTooLong) {
      document.getElementById(`${uid}-note`)?.focus();
      return;
    }
    if (
      decision === "LOCK_TENANT" &&
      !window.confirm(`Khoá gian hàng “${tenantName}”? Trang bán sẽ ngừng hiển thị và chủ gian hàng nhận email thông báo. Có thể mở khoá lại ở mục Gian hàng.`)
    ) {
      return;
    }
    const fd = new FormData(event.currentTarget);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined} className="space-y-5">
      <div ref={bannerRef} tabIndex={-1} className="outline-none empty:hidden">
        {state.error ? <FormBanner ok={false} message={state.error} /> : null}
        {state.ok ? <FormBanner ok message={`Đã xử lý ${state.resolvedCount ?? 1} báo cáo.`} /> : null}
      </div>

      <fieldset aria-describedby={decisionError ? `${uid}-decision-error` : undefined}>
        <legend className="text-sm font-semibold" style={{ color: INK }}>
          Quyết định <span aria-hidden="true" style={{ color: RED }}>*</span>
          <span className="sr-only"> (bắt buộc)</span>
        </legend>
        <div className="mt-2 space-y-2">
          {allowedDecisions.map((value) => {
            const id = `${uid}-decision-${value}`;
            const checked = decision === value;
            const danger = value === "LOCK_TENANT";
            return (
              <label
                key={value}
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-primary,#0F3B82)] motion-reduce:transition-none"
                style={{
                  borderColor: checked ? (danger ? RED : brandColors.primary) : decisionError ? RED_LINE : LINE,
                  background: checked ? (danger ? "#FEF2F2" : brandColors.surface) : "#FFFFFF",
                }}
              >
                <input
                  id={id}
                  type="radio"
                  name="decision"
                  value={value}
                  checked={checked}
                  onChange={() => {
                    setDecision(value);
                    setDecisionError(null);
                  }}
                  disabled={pending}
                  aria-describedby={`${id}-hint`}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0F3B82]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: danger ? RED : INK }}>
                    {ABUSE_REPORT_DECISION_LABELS[value]}
                  </span>
                  <span id={`${id}-hint`} className="mt-0.5 block text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                    {decisionHint(value, targetType)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {decisionError ? (
          <p id={`${uid}-decision-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
            {decisionError}
          </p>
        ) : null}
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${uid}-note`} className="text-sm font-semibold" style={{ color: INK }}>
            Ghi chú nội bộ <span className="font-normal" style={{ color: INK_SOFT }}>(tuỳ chọn)</span>
          </label>
          <span
            id={`${uid}-note-count`}
            className="shrink-0 text-xs tabular-nums"
            style={{ color: noteTooLong ? RED : INK_SOFT, fontWeight: noteTooLong ? 600 : undefined }}
          >
            {noteLength.toLocaleString("vi-VN")}/{ABUSE_REPORT_NOTE_MAX_LENGTH.toLocaleString("vi-VN")}
            <span className="sr-only"> ký tự</span>
          </span>
        </div>
        <textarea
          id={`${uid}-note`}
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          aria-invalid={noteTooLong ? true : undefined}
          aria-describedby={`${uid}-note-hint ${uid}-note-count`}
          className="mt-1.5 block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
          style={{ borderColor: noteTooLong ? RED : LINE }}
        />
        <p id={`${uid}-note-hint`} className="mt-1.5 text-xs" style={{ color: noteTooLong ? RED : INK_SOFT }}>
          {noteTooLong
            ? `Ghi chú tối đa ${ABUSE_REPORT_NOTE_MAX_LENGTH.toLocaleString("vi-VN")} ký tự.`
            : "Chỉ quản trị viên thấy — không gửi cho gian hàng hay người báo cáo."}
        </p>
      </div>

      {otherOpenReports > 0 ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm" style={{ borderColor: LINE, color: INK }}>
          <input type="checkbox" name="applyToSameTarget" defaultChecked disabled={pending} className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0F3B82]" />
          <span>
            Áp cùng quyết định cho <strong className="font-semibold">{otherOpenReports}</strong> báo cáo khác đang chờ về cùng nội dung
            <span className="mt-0.5 block text-xs" style={{ color: INK_SOFT }}>
              Bỏ chọn để chỉ đóng báo cáo này; các báo cáo kia vẫn chờ xử lý riêng.
            </span>
          </span>
        </label>
      ) : null}

      <p className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        <IconMail className="mt-0.5 h-4 w-4 shrink-0" />
        Người báo cáo nhận email kết quả; chủ gian hàng nhận email khi có biện pháp (không kèm danh tính người báo cáo).
      </p>

      <button type="submit" disabled={pending} className={`${BTN} w-full text-white hover:brightness-110`} style={{ background: decision === "LOCK_TENANT" ? RED : brandColors.primary }}>
        {pending ? "Đang xử lý…" : decision === "LOCK_TENANT" ? "Xác nhận khoá gian hàng" : "Xác nhận xử lý"}
      </button>
    </form>
  );
}

/** Hệ quả gỡ khoá theo `unlockModeration` (lib/abuse-report.ts): sản phẩm giữ Lưu trữ, đánh giá giữ ẩn, bài viết về nháp. */
const UNLOCK_EFFECT: Record<AbuseTargetTypeValue, string> = {
  PRODUCT: "Tài liệu vẫn ở trạng thái Lưu trữ; gian hàng sẽ tự khôi phục và xuất bản lại được.",
  REVIEW: "Đánh giá vẫn đang ẩn; gian hàng sẽ tự bỏ ẩn được.",
  POST: "Bài viết chuyển về Bản nháp; gian hàng sẽ tự sửa và đăng lại được.",
};

/** Gỡ khoá kiểm duyệt cho đối tượng đang bị khoá (có xác nhận). */
export function UnlockModerationButton({ targetType, targetId }: { targetType: AbuseTargetTypeValue; targetId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReportActionState>({});

  function unlock() {
    if (!window.confirm(`Gỡ khoá kiểm duyệt ${TARGET_NOUN[targetType]} này? ${UNLOCK_EFFECT[targetType]}`)) return;
    setResult({});
    startTransition(async () => setResult(await unlockModerationAction(targetType, targetId)));
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={unlock} className={`${BTN} w-full border bg-white hover:bg-gray-50 sm:w-auto`} style={{ borderColor: LINE, color: INK }}>
        <IconUnlock className="h-4 w-4" />
        {pending ? "Đang gỡ khoá…" : "Gỡ khoá kiểm duyệt"}
      </button>
      {result.error ? <FormBanner ok={false} message={result.error} /> : null}
      {result.ok ? <FormBanner ok message="Đã gỡ khoá kiểm duyệt." /> : null}
    </div>
  );
}
