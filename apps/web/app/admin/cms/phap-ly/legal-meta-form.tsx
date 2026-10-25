"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { LEGAL_SUMMARY_MAX, type LegalDocumentKey } from "@gieochu/core/legal";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, seoLengthWarning } from "@gieochu/core/seo";
import { FormBanner, PrimaryButton, TextField } from "../../_ui/kit";
import { saveLegalDocumentMetaAction } from "./actions";

/**
 * ADR-054 mục 4 — mô tả ngắn + SEO của một văn bản pháp lý. Lưu thẳng (không nháp, như SEO trang chủ ADR-050 lần 2), có
 * đếm ký tự + cảnh báo mềm độ dài (60/160) như editor trang chủ. Server kiểm lại giới hạn (120/320/320).
 * Bố cục đồng bộ khung "SEO trang chủ": nhãn kèm bộ đếm, gợi ý/cảnh báo ngay dưới ô (aria-describedby), nhóm SEO bằng
 * fieldset; trạng thái đang lưu qua vùng `role="status"` ẩn, kết quả qua `FormBanner` (status/alert).
 */
export interface LegalMetaValues {
  summary: string;
  seoTitle: string;
  seoDescription: string;
}

// Cùng giá trị với editor trang chủ + `_ui/kit` (viền ô nhập xám trung tính, không phải brand token).
const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const TEXTAREA =
  "mt-1.5 block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15 motion-reduce:transition-none";

function TextAreaField({ id, label, value, maxLength, hint, onChange }: { id: string; label: string; value: string; maxLength: number; hint: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <textarea id={id} rows={3} className={TEXTAREA} style={{ borderColor: LINE }} value={value} maxLength={maxLength} aria-describedby={`${id}-hint`} onChange={(e) => onChange(e.target.value)} />
      <p id={`${id}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
        {hint}
      </p>
    </div>
  );
}

export function LegalMetaForm({ documentKey, initial, defaultTitle }: { documentKey: LegalDocumentKey; initial: LegalMetaValues; defaultTitle: string }) {
  const router = useRouter();
  const [values, setValues] = useState<LegalMetaValues>(initial);
  const [saved, setSaved] = useState<LegalMetaValues>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = values.summary !== saved.summary || values.seoTitle !== saved.seoTitle || values.seoDescription !== saved.seoDescription;
  const titleWarning = seoLengthWarning("title", values.seoTitle);
  const descriptionWarning = seoLengthWarning("description", values.seoDescription);
  // Thông báo "Đã lưu" hết đúng khi người dùng sửa tiếp → ẩn (lỗi vẫn giữ tới lần lưu sau).
  const visibleMessage = message && !(message.ok && dirty) ? message : null;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveLegalDocumentMetaAction(documentKey, values);
      if (result.success) {
        setSaved(values);
        setMessage({ ok: true, text: "Đã lưu mô tả & SEO — áp dụng ngay cho trang công khai." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error ?? "Lưu thất bại." });
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-6" style={{ borderColor: LINE }} aria-labelledby="legal-meta-heading" aria-describedby="legal-meta-desc">
      <h2 id="legal-meta-heading" className="font-[family-name:var(--font-heading)] text-lg font-semibold" style={{ color: INK }}>
        Mô tả & SEO
      </h2>
      <p id="legal-meta-desc" className="mt-1 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
        Không bắt buộc. Không theo phiên bản: lưu xong là áp dụng ngay cho trang công khai. Dùng <code>{"{brand}"}</code> thay cho tên nền tảng.
      </p>

      <div className="mt-5 space-y-5">
        <TextAreaField
          id="legal-summary"
          label={`Mô tả ngắn (${values.summary.length}/${LEGAL_SUMMARY_MAX})`}
          value={values.summary}
          maxLength={LEGAL_SUMMARY_MAX}
          hint="Một–hai câu tóm tắt văn bản. Cũng là mô tả SEO khi để trống ô mô tả SEO bên dưới."
          onChange={(summary) => setValues((prev) => ({ ...prev, summary }))}
        />

        <fieldset className="space-y-4 border-t pt-5" style={{ borderColor: LINE }}>
          <legend className="float-left mb-1 w-full text-sm font-semibold" style={{ color: INK }}>
            Kết quả tìm kiếm (SEO)
          </legend>
          <div className="clear-both space-y-4">
            <TextField
              id="legal-seo-title"
              label={`Tiêu đề SEO (${values.seoTitle.length}/${SEO_TITLE_MAX})`}
              value={values.seoTitle}
              maxLength={SEO_TITLE_MAX}
              hint={titleWarning ?? `Khuyến nghị ≤ 60 ký tự. Để trống → “${defaultTitle} | tên nền tảng”.`}
              onChange={(e) => setValues((prev) => ({ ...prev, seoTitle: e.target.value }))}
            />
            <TextAreaField
              id="legal-seo-description"
              label={`Mô tả SEO (${values.seoDescription.length}/${SEO_DESCRIPTION_MAX})`}
              value={values.seoDescription}
              maxLength={SEO_DESCRIPTION_MAX}
              hint={descriptionWarning ?? "Khuyến nghị ≤ 160 ký tự. Để trống → dùng mô tả ngắn."}
              onChange={(seoDescription) => setValues((prev) => ({ ...prev, seoDescription }))}
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center" style={{ borderColor: LINE }}>
          <PrimaryButton type="button" disabled={isPending || !dirty} aria-describedby="legal-meta-save-state" onClick={save}>
            {isPending ? "Đang lưu..." : "Lưu mô tả & SEO"}
          </PrimaryButton>
          <p id="legal-meta-save-state" role="status" className="text-xs empty:sr-only" style={{ color: INK_SOFT }}>
            {isPending ? "Đang lưu mô tả & SEO…" : dirty ? "Có thay đổi chưa lưu." : visibleMessage ? "" : "Chưa có thay đổi."}
          </p>
          {visibleMessage ? (
            <div className="min-w-0 sm:flex-1">
              <FormBanner ok={visibleMessage.ok} message={visibleMessage.text} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
