"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core" — barrel kéo code server-only vào bundle client).
import {
  PRICING_SECTION_LABELS,
  PRICING_SEO_DESCRIPTION_MAX,
  PRICING_SEO_TITLE_MAX,
  type PricingSection,
  type PricingSectionIssue,
} from "@gieochu/core/pricing-sections";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { Badge, GhostButton, Notice, PrimaryButton, TextField } from "../../../_ui/kit";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown, IconExternalLink, IconEye, IconEyeOff, IconGlobe } from "../../../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../../_ui/collapsible-section";
import { useUnsavedChanges } from "../../../_ui/unsaved-changes";
import { publishPricingAction, restoreLivePricingAction, savePricingDraftAction } from "../actions";
import { PricingSectionFields, type PricingFormContext } from "./pricing-section-forms";
import {
  describePricingField,
  isPricingListField,
  mergeServerIssues,
  pricingFieldId,
  toPricingErrorMap,
  validatePricingSections,
  type PricingFieldIssue,
} from "./pricing-validation";

/**
 * Editor CMS Bảng giá (ADR-041 A, GĐ2 — thay editor JSON tối thiểu). Cùng pattern editor Cửa hàng (UI-Design-System §13.3):
 * thanh trạng thái dính, danh sách 9 khu vực (ẩn/hiện, Lên/Xuống), form khu vực đang chọn, kiểm tra trước khi gửi bằng
 * đúng schema server + tham chiếu gói, khung tóm tắt lỗi nhận focus và dẫn tới đúng ô, cảnh báo rời trang khi chưa lưu.
 * Lỗi server trả về (`issues` theo section/field) gộp vào cùng khung tóm tắt và hiện dưới từng ô.
 */

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const ICON_BTN = `inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent lg:h-9 lg:w-9 ${FOCUS}`;
const BAR_BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`;

const PUBLIC_PATH = "/pricing";
const PREVIEW_PATH = "/pricing?xem-truoc=nhap";

export type PricingEditorStatus = "NONE" | "DRAFT" | "PUBLISHED";
type PendingAction = "save" | "publish" | "restore";
export interface PricingSeoValue {
  seoTitle: string;
  seoDescription: string;
}

function formatSavedAt(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PricingSectionsEditor({
  initialSections,
  live,
  initialHasDraft,
  initialStatus,
  updatedAtLabel,
  initialSeo,
  ctx,
}: {
  initialSections: PricingSection[];
  live: PricingSection[];
  initialHasDraft: boolean;
  initialStatus: PricingEditorStatus;
  /** Lần sửa gần nhất đã định dạng ở server (Asia/Ho_Chi_Minh); null khi chưa có dòng. */
  updatedAtLabel: string | null;
  /** SEO đang lưu (cột riêng, không có nháp). */
  initialSeo: PricingSeoValue;
  ctx: PricingFormContext;
}) {
  const [sections, setSections] = useState<PricingSection[]>(initialSections);
  const [liveSections, setLiveSections] = useState<PricingSection[]>(live);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [status, setStatus] = useState<PricingEditorStatus>(initialStatus);
  const [savedLabel, setSavedLabel] = useState<string | null>(updatedAtLabel);
  const [selectedId, setSelectedId] = useState<string>(initialSections[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  /** Đã bấm Lưu/Xuất bản ít nhất 1 lần → bật hiển thị lỗi (cập nhật theo từng thay đổi). */
  const [attempted, setAttempted] = useState(false);
  /** Lỗi server trả về ở lần gửi gần nhất (vd gói vừa bị xoá ở tab khác) — xoá khi gửi lại. */
  const [serverIssues, setServerIssues] = useState<PricingSectionIssue[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSections));
  const [seo, setSeo] = useState<PricingSeoValue>(initialSeo);
  const [savedSeo, setSavedSeo] = useState<PricingSeoValue>(initialSeo);
  /** Tăng khi khôi phục — buộc form dựng lại. */
  const [formVersion, setFormVersion] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ target: string; seq: number } | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);

  const planRefs = ctx.plans.map((plan) => ({ id: plan.id, isFree: plan.isFree }));
  const seoDirty = seo.seoTitle !== savedSeo.seoTitle || seo.seoDescription !== savedSeo.seoDescription;
  const isDirty = JSON.stringify(sections) !== savedSnapshot || seoDirty;
  const clientIssues: PricingFieldIssue[] = attempted ? validatePricingSections(sections, planRefs) : [];
  const issues = serverIssues.length > 0 ? mergeServerIssues(clientIssues, serverIssues, sections) : clientIssues;
  const errorMap = toPricingErrorMap(issues);
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const visibleCount = sections.filter((s) => s.visible).length;
  const planName = (planId: string) => ctx.plans.find((plan) => plan.id === planId)?.name;

  // ADR-058 mục 5: cờ "chưa lưu" đăng ký với provider của layout (beforeunload chung + chặn sidebar/tab).
  useUnsavedChanges(isDirty, "Trang Bảng giá có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "__summary") {
      summaryRef.current?.focus();
      return;
    }
    const el = document.getElementById(focusRequest.target);
    if (el) el.focus();
    else editorHeadingRef.current?.focus();
  }, [focusRequest]);

  function requestFocus(target: string) {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }

  function updateSelectedData(data: PricingSection["data"]) {
    setSections((prev) => prev.map((s) => (s.id === selected?.id ? ({ ...s, data } as PricingSection) : s)));
  }

  function toggleVisible(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  }

  function move(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  function goToIssue(issue: PricingFieldIssue) {
    setSelectedId(issue.sectionId);
    if (!issue.sectionType) return requestFocus("__heading");
    const fieldId = pricingFieldId(issue.sectionType, issue.field);
    requestFocus(isPricingListField(issue.field) ? `${fieldId}-add` : fieldId);
  }

  /** Kiểm tra trước khi gửi; lỗi → hiện tóm tắt + focus vào đó, không gọi server. */
  function passesClientCheck(): boolean {
    setAttempted(true);
    setServerIssues([]);
    if (validatePricingSections(sections, planRefs).length === 0) return true;
    setMessage(null);
    requestFocus("__summary");
    return false;
  }

  function submit(kind: "save" | "publish") {
    if (!passesClientCheck()) return;
    const snapshot = JSON.stringify(sections);
    const submitted = sections;
    const submittedSeo = seo;
    setPendingAction(kind);
    startTransition(async () => {
      const result = kind === "save" ? await savePricingDraftAction(submitted, submittedSeo) : await publishPricingAction(submitted, submittedSeo);
      if (result.success) {
        if (kind === "save") {
          setHasDraft(true);
          setStatus((prev) => (prev === "NONE" ? "DRAFT" : prev));
        } else {
          setHasDraft(false);
          setStatus("PUBLISHED");
          setLiveSections(submitted);
        }
        setSavedSnapshot(snapshot);
        setSavedSeo(submittedSeo);
        setSavedLabel(formatSavedAt(new Date()));
        setMessage({
          ok: true,
          text: kind === "save" ? "Đã lưu bản nháp — trang Bảng giá công khai chưa thay đổi. Bấm “Xem trước bản nháp” để kiểm tra." : "Đã xuất bản — trang Bảng giá đã cập nhật.",
        });
        return;
      }
      setMessage({ ok: false, text: result.error ?? (kind === "save" ? "Lưu nháp thất bại." : "Xuất bản thất bại.") });
      if (result.issues && result.issues.length > 0) {
        setServerIssues(result.issues);
        requestFocus("__summary");
      }
    });
  }

  function restoreLive() {
    const target = status === "PUBLISHED" ? "bản đang hiển thị" : "cấu hình mặc định";
    if (!window.confirm(`Bỏ bản nháp và mọi thay đổi chưa xuất bản, quay về ${target}? Thao tác này không hoàn tác được.`)) return;
    setPendingAction("restore");
    startTransition(async () => {
      const result = await restoreLivePricingAction();
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Khôi phục thất bại." });
        return;
      }
      setSections(liveSections);
      setSelectedId((prev) => (liveSections.some((s) => s.id === prev) ? prev : (liveSections[0]?.id ?? "")));
      setHasDraft(false);
      setAttempted(false);
      setServerIssues([]);
      setFormVersion((v) => v + 1);
      setSavedSnapshot(JSON.stringify(liveSections));
      // SEO không có nháp — bỏ thay đổi chưa lưu, quay về giá trị đang lưu.
      setSeo(savedSeo);
      setMessage({ ok: true, text: status === "PUBLISHED" ? "Đã khôi phục về bản đang hiển thị." : "Đã khôi phục về cấu hình mặc định." });
    });
  }

  const busy = (action: PendingAction) => isPending && pendingAction === action;

  return (
    <div className="mt-6 space-y-4">
      {status === "NONE" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa lưu lần nào — trang đang hiển thị cấu hình mặc định.</strong> Lần Lưu nháp hoặc Xuất bản đầu tiên sẽ tạo cấu hình trang Bảng giá.
        </Notice>
      ) : status === "DRAFT" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa xuất bản lần nào.</strong> Trang Bảng giá công khai dùng cấu hình mặc định cho tới khi bạn bấm Xuất bản.
        </Notice>
      ) : null}

      {/* Thanh trạng thái + hành động — dính đầu vùng cuộn để luôn thấy nút khi sửa form dài. */}
      <div className="sticky top-0 z-10 -mx-5 border-y bg-white/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8" style={{ borderColor: LINE }}>
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {status === "PUBLISHED" ? (
              <Badge tone="success">Đã xuất bản</Badge>
            ) : status === "DRAFT" ? (
              <Badge tone="neutral">Chưa xuất bản</Badge>
            ) : (
              <Badge tone="neutral">Chưa lưu · cấu hình mặc định</Badge>
            )}
            {hasDraft ? <Badge tone="warning">Có nháp chưa xuất bản</Badge> : null}
            {isDirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
            {savedLabel ? (
              <span className="text-xs" style={{ color: INK_SOFT }}>
                Lưu lần cuối: {savedLabel}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={PUBLIC_PATH} target="_blank" rel="noreferrer" className={BAR_BTN} style={{ borderColor: LINE, color: INK }}>
              <IconExternalLink className="h-4 w-4" /> Xem trang
              <span className="sr-only">(mở tab mới — bản đã xuất bản)</span>
            </Link>
            <Link
              href={PREVIEW_PATH}
              target="_blank"
              rel="noreferrer"
              aria-describedby="pricing-preview-note"
              className={BAR_BTN}
              style={{ borderColor: LINE, color: INK }}
            >
              <IconEye className="h-4 w-4" /> Xem trước bản nháp
              <span className="sr-only">(mở tab mới)</span>
            </Link>
            <GhostButton onClick={restoreLive} disabled={isPending || (!hasDraft && !isDirty)} className={BAR_BTN}>
              {busy("restore") ? "Đang khôi phục..." : "Khôi phục bản đang hiển thị"}
            </GhostButton>
            <GhostButton onClick={() => submit("save")} disabled={isPending} className={BAR_BTN}>
              {busy("save") ? "Đang lưu..." : "Lưu nháp"}
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={() => submit("publish")}
              disabled={isPending}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}
            >
              <IconCheckCircle className="h-4 w-4" /> {busy("publish") ? "Đang xuất bản..." : "Xuất bản"}
            </PrimaryButton>
          </div>
        </div>
        <p id="pricing-preview-note" className="mt-2 text-xs" style={{ color: INK_SOFT }}>
          Xem trước hiển thị bản nháp <strong>đã lưu</strong>, giao diện như khách chưa đăng nhập{isDirty ? " — bấm Lưu nháp trước để thấy thay đổi mới nhất." : "."}
        </p>
        {message ? (
          <p
            role={message.ok ? "status" : "alert"}
            className="mt-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium"
            style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D" } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C" }}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="pricing-error-summary-title"
          className={`rounded-xl border px-4 py-3 ${FOCUS}`}
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }}
        >
          <h2 id="pricing-error-summary-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#B91C1C" }}>
            <IconAlertTriangle className="h-4 w-4 shrink-0" /> Chưa lưu được — còn {issues.length} lỗi cần sửa
          </h2>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => {
              const where = describePricingField(issue.sectionType, issue.field, planName);
              return (
                <li key={`${issue.sectionId}-${issue.field}`}>
                  <button
                    type="button"
                    onClick={() => goToIssue(issue)}
                    className={`min-h-11 cursor-pointer rounded text-left text-sm underline underline-offset-2 lg:min-h-0 ${FOCUS}`}
                    style={{ color: "#B91C1C" }}
                  >
                    {issue.sectionType ? PRICING_SECTION_LABELS[issue.sectionType] : "Cấu hình"}
                    {where ? ` · ${where}` : ""}: {issue.message}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start rounded-2xl border bg-white p-4" style={{ borderColor: LINE }} aria-labelledby="pricing-sections-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="pricing-sections-heading" className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
              Các khu vực trên trang
            </h2>
            <span className="text-xs" style={{ color: INK_SOFT }}>
              {visibleCount}/{sections.length} đang hiện
            </span>
          </div>
          <ol className="space-y-1.5">
            {sections.map((s, i) => {
              const isSelected = s.id === selected?.id;
              const label = PRICING_SECTION_LABELS[s.type];
              const errorCount = Object.keys(errorMap[s.id] ?? {}).length;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-xl border p-1 transition-colors"
                  style={{ borderColor: isSelected ? brandColors.accent : LINE, background: isSelected ? brandColors.accentSoft : "white" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleVisible(s.id)}
                    aria-pressed={s.visible}
                    aria-label={`${s.visible ? "Ẩn" : "Hiện"} khu vực ${label}`}
                    title={s.visible ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                    className={ICON_BTN}
                    style={{ color: s.visible ? "#15803D" : "#6B7280" }}
                  >
                    {s.visible ? <IconEye className="h-[18px] w-[18px]" /> : <IconEyeOff className="h-[18px] w-[18px]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center rounded-lg px-1.5 text-left lg:min-h-9 ${FOCUS}`}
                  >
                    <span className="w-full truncate text-sm font-medium" style={{ color: s.visible ? INK : INK_SOFT }}>
                      <span className="mr-1 tabular-nums" style={{ color: INK_SOFT }}>
                        {i + 1}.
                      </span>
                      {label}
                    </span>
                    {!s.visible || errorCount > 0 ? (
                      <span className="flex flex-wrap gap-x-2 text-[11px] font-semibold">
                        {!s.visible ? <span style={{ color: INK_SOFT }}>Đang ẩn</span> : null}
                        {errorCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5" style={{ color: "#B91C1C" }}>
                            <IconAlertTriangle className="h-3 w-3" /> {errorCount} lỗi
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Đưa khu vực ${label} lên`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Đưa khu vực ${label} xuống`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
            Bấm tên khu vực để sửa. Con mắt để ẩn/hiện, mũi tên để đổi thứ tự. Khu vực không có dữ liệu (số liệu bằng 0, chưa có câu hỏi, chưa bật cổng thanh toán) tự ẩn
            trên trang.
          </p>
        </aside>

        <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6" style={{ borderColor: LINE }} aria-labelledby="pricing-section-editor-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4" style={{ borderColor: LINE }}>
            <h2
              id="pricing-section-editor-heading"
              ref={editorHeadingRef}
              tabIndex={-1}
              className="font-[family-name:var(--font-heading)] text-lg font-semibold outline-none"
              style={{ color: INK }}
            >
              {selected ? PRICING_SECTION_LABELS[selected.type] : ""}
            </h2>
            {selected && !selected.visible ? <Badge tone="neutral">Đang ẩn trên trang</Badge> : null}
          </div>
          <p className="mb-4 text-xs" style={{ color: INK_SOFT }}>
            Ô không ghi “(không bắt buộc)” là bắt buộc.
          </p>
          {selected ? (
            <PricingSectionFields key={`${selected.id}-${formVersion}`} section={selected} errors={errorMap[selected.id] ?? {}} ctx={ctx} onChange={updateSelectedData} />
          ) : null}
        </section>
      </div>

      {/* ADR-058: khối SEO luôn thu gọn, kiểu section Rank Math (tiêu đề + badge trạng thái có chữ + chevron). */}
      <CollapsibleSection
        id="seo"
        title="SEO trang Bảng giá"
        description="Không bắt buộc — để trống dùng tiêu đề/mô tả mặc định."
        icon={<IconGlobe className="h-5 w-5" />}
        status={sectionStatus({
          dirty: seoDirty,
          empty: seo.seoTitle.trim() === "" && seo.seoDescription.trim() === "",
          emptyLabel: "Dùng mặc định",
        })}
      >
        <p className="text-xs" style={{ color: INK_SOFT }}>
          SEO không có bản nháp: bấm <strong>Lưu nháp</strong> hoặc <strong>Xuất bản</strong> đều ghi SEO và áp dụng ngay cho trang
          công khai (nếu trang đã xuất bản).
        </p>
        <div className="space-y-4">
          <TextField
            id="pricing-seo-title"
            label="Tiêu đề SEO (không bắt buộc)"
            value={seo.seoTitle}
            maxLength={PRICING_SEO_TITLE_MAX}
            hint={`Tối đa ${PRICING_SEO_TITLE_MAX} ký tự.`}
            onChange={(event) => setSeo((prev) => ({ ...prev, seoTitle: event.target.value }))}
          />
          <div>
            <label htmlFor="pricing-seo-description" className="block text-sm font-medium" style={{ color: INK }}>
              Mô tả SEO (không bắt buộc)
            </label>
            <textarea
              id="pricing-seo-description"
              value={seo.seoDescription}
              maxLength={PRICING_SEO_DESCRIPTION_MAX}
              rows={3}
              aria-describedby="pricing-seo-description-hint"
              onChange={(event) => setSeo((prev) => ({ ...prev, seoDescription: event.target.value }))}
              className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
              style={{ borderColor: LINE }}
            />
            <p id="pricing-seo-description-hint" className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
              Tối đa {PRICING_SEO_DESCRIPTION_MAX} ký tự ({seo.seoDescription.length}/{PRICING_SEO_DESCRIPTION_MAX}).
            </p>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
