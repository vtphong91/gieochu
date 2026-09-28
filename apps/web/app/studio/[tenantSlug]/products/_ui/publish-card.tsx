"use client";

import type { ReactNode, Ref } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { Badge, ConfigCard, GhostButton } from "../../../../admin/_ui/kit";
import { IconCheckCircle, IconExternalLink, IconGlobe, IconLock, IconShield, IconXCircle } from "../../../../admin/_ui/icons";
import { GHOST_BTN, GREEN_TEXT, PRODUCT_STATUS_LABEL, PRODUCT_STATUS_TONE, WarningNote } from "./editor-bits";

export type Visibility = "PUBLIC" | "PRIVATE";

const RED = "#DC2626";
const RED_LINE = "#FCA5A5";
const AMBER = "#B45309";
const GRAY_LINE = "#E5E7EB";
const INK_SOFT = "#6B7280";

const OPTIONS: { value: Visibility; label: string; description: string; icon: ReactNode }[] = [
  {
    value: "PUBLIC",
    label: "Công khai",
    description: "Hiện trên trang bán — khách xem và mua được.",
    icon: <IconGlobe className="h-[18px] w-[18px]" />,
  },
  {
    value: "PRIVATE",
    label: "Riêng tư",
    description: "Chỉ bạn thấy trong Studio. Dùng khi đang soạn hoặc muốn tạm ẩn.",
    icon: <IconLock className="h-[18px] w-[18px]" />,
  },
];

export interface ChecklistItem {
  requirement: string;
  label: string;
  passed: boolean;
  message?: string;
}

/**
 * Card xuất bản của editor sản phẩm (kiểu hộp "Publish" — ADR-027 §1): chế độ hiển thị (Công khai = PUBLISHED,
 * Riêng tư = DRAFT) → checklist điều kiện (trang Sửa) → dòng trạng thái lưu (aria-live) → nút hành động → chân
 * card Lưu trữ/Khôi phục (tách khỏi nút chính bằng đường kẻ — hành động phá huỷ đứng riêng).
 * Radio chỉ là lựa chọn. Chưa công khai: gửi theo nút bấm ("Xuất bản" / "Lưu nháp"), radio được đồng bộ theo nút;
 * PUBLISHED: áp dụng khi bấm nút chính ngay bên dưới.
 * Sản phẩm ARCHIVED không có radio, chỉ còn "Khôi phục". Radio dạng thẻ (label bọc input gốc) → vùng bấm ≥ 44px.
 * `containerRef` (id `publish-status`) nhận focus khi bị chặn công khai.
 */
export function PublishCard({
  containerRef,
  value,
  onChange,
  status,
  checklist,
  publishReasons,
  visibilityError,
  statusMessage,
  actions,
  actionsRef,
  busy,
  publicHref,
  onArchive,
  onRestore,
}: {
  containerRef?: Ref<HTMLDivElement>;
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** null = trang Tạo (chưa có sản phẩm). */
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  /** Điều kiện xuất bản từ loader — chỉ có ở trang Sửa. */
  checklist: { allowed: boolean; items: ChecklistItem[] } | null;
  publishReasons?: { code: string; message: string }[];
  /** Lỗi field `visibility` từ Server Action. */
  visibilityError?: string;
  /** Dòng trạng thái lưu — vùng aria-live duy nhất của editor. */
  statusMessage: ReactNode;
  /** Nút Xem trước / Lưu nháp / nút chính (do editor dựng — giữ logic submit ở một chỗ). */
  actions: ReactNode;
  /** Theo dõi khối nút đang trong tầm nhìn hay không (thanh lưu nhanh ở mobile). */
  actionsRef?: Ref<HTMLDivElement>;
  busy: boolean;
  /** Link trang đang bán (chỉ khi PUBLISHED). */
  publicHref?: string;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const archived = status === "ARCHIVED";
  const currentVisibility: Visibility | null = status === "PUBLISHED" ? "PUBLIC" : status === "DRAFT" ? "PRIVATE" : null;
  const pendingChange = currentVisibility !== null && value !== currentVisibility;

  let footer: ReactNode;
  if (archived) {
    footer = onRestore ? (
      <GhostButton onClick={onRestore} disabled={busy} className={`${GHOST_BTN} w-full`}>
        Khôi phục về Riêng tư
      </GhostButton>
    ) : undefined;
  } else if (status) {
    footer = (
      <div className="flex flex-col gap-2">
        {status === "PUBLISHED" && publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold sm:min-h-8"
            style={{ color: brandColors.primary }}
          >
            Xem trang đang bán <IconExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">(mở tab mới)</span>
          </Link>
        ) : null}
        {onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy}
            className={`${GHOST_BTN} w-full`}
            style={{ borderColor: RED_LINE, color: RED }}
          >
            Lưu trữ sản phẩm
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="publish-status"
      tabIndex={-1}
      // Vòng focus vẽ VÀO TRONG (outline offset âm) — không bị khung cha cắt.
      className="rounded-2xl outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0F3B82]"
    >
      <ConfigCard
        icon={<IconShield className="h-5 w-5" />}
        title="Chế độ hiển thị"
        badges={
          status ? (
            <Badge tone={PRODUCT_STATUS_TONE[status] ?? "neutral"}>
              {archived ? PRODUCT_STATUS_LABEL[status] : currentVisibility === "PUBLIC" ? "Đang công khai" : "Đang riêng tư"}
            </Badge>
          ) : null
        }
        footer={footer}
      >
        {publishReasons && publishReasons.length > 0 ? (
          <WarningNote title="Chưa công khai được — đã lưu ở chế độ Riêng tư">
            <ul className="list-disc space-y-0.5 pl-4">
              {publishReasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </WarningNote>
        ) : null}

        {archived ? (
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Sản phẩm đã lưu trữ và đang ẩn khỏi trang bán. Khôi phục để chọn lại Công khai hoặc Riêng tư.
          </p>
        ) : (
          <fieldset id="visibility" tabIndex={-1} className="outline-none" aria-describedby={visibilityError ? "visibility-error" : undefined}>
            <legend className="sr-only">Chế độ hiển thị</legend>
            <div className="space-y-2">
              {OPTIONS.map((option) => {
                const checked = value === option.value;
                return (
                  <label
                    key={option.value}
                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0F3B82] motion-reduce:transition-none"
                    style={{
                      borderColor: checked ? brandColors.primary : GRAY_LINE,
                      background: checked ? brandColors.surface : "#FFFFFF",
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={checked}
                      onChange={() => onChange(option.value)}
                      disabled={busy}
                      aria-describedby={`visibility-${option.value}-desc`}
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#0F3B82]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: brandColors.ink }}>
                        <span aria-hidden="true" style={{ color: checked ? brandColors.primary : INK_SOFT }}>
                          {option.icon}
                        </span>
                        {option.label}
                        {currentVisibility === option.value ? (
                          <span className="text-xs font-medium" style={{ color: INK_SOFT }}>
                            (hiện tại)
                          </span>
                        ) : null}
                      </span>
                      <span id={`visibility-${option.value}-desc`} className="mt-0.5 block text-xs" style={{ color: INK_SOFT }}>
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {pendingChange && status === "PUBLISHED" ? (
              <p className="mt-2 text-xs font-medium" style={{ color: AMBER }}>
                Thay đổi sẽ áp dụng khi bạn bấm Lưu.
              </p>
            ) : null}
            {value === "PUBLIC" && currentVisibility !== "PUBLIC" ? (
              <p id="visibility-publish-hint" className="mt-2 text-xs" style={{ color: INK_SOFT }}>
                <span className="font-medium" style={{ color: AMBER }}>
                  Bấm Xuất bản để công khai.
                </span>{" "}
                Cần đủ điều kiện xuất bản — nếu chưa đủ, tài liệu được lưu Riêng tư và bạn sẽ thấy các mục còn thiếu.
              </p>
            ) : null}
            {visibilityError ? (
              <p id="visibility-error" role="alert" className="mt-2 text-sm" style={{ color: RED }}>
                {visibilityError}
              </p>
            ) : null}
          </fieldset>
        )}

        {checklist && !archived ? (
          <div className="border-t pt-4" style={{ borderColor: GRAY_LINE }}>
            <p id="publish-checklist-title" className="text-sm font-semibold" style={{ color: brandColors.ink }}>
              {status === "PUBLISHED" ? "Điều kiện bán" : "Điều kiện công khai"}
              {" · "}
              <span style={{ color: checklist.allowed ? GREEN_TEXT : AMBER }}>
                {checklist.allowed ? "Đã đủ" : `Còn ${checklist.items.filter((c) => !c.passed).length} mục`}
              </span>
            </p>
            <ul aria-labelledby="publish-checklist-title" className="mt-2 space-y-2">
              {checklist.items.map((item) => (
                <li key={item.requirement} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0" style={{ color: item.passed ? brandColors.secondary : RED }} aria-hidden="true">
                    {item.passed ? <IconCheckCircle className="h-[18px] w-[18px]" /> : <IconXCircle className="h-[18px] w-[18px]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="sr-only">{item.passed ? "Đạt: " : "Chưa đạt: "}</span>
                    <span style={{ color: item.passed ? brandColors.ink : RED }} className={item.passed ? undefined : "font-medium"}>
                      {item.label}
                    </span>
                    {!item.passed && item.message ? (
                      <span className="block text-xs" style={{ color: INK_SOFT }}>
                        {item.message}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div ref={actionsRef} className="space-y-3 border-t pt-4" style={{ borderColor: GRAY_LINE }}>
          <p role="status" aria-live="polite" className="min-h-5 text-sm" style={{ color: INK_SOFT }}>
            {statusMessage}
          </p>
          {actions}
        </div>
      </ConfigCard>
    </div>
  );
}
