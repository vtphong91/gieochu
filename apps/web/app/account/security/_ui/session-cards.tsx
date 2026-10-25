"use client";

import { useRef, useState, useTransition } from "react";
import { brandColors } from "@gieochu/config/theme";
import { Badge } from "../../../admin/_ui/kit";
import { IconMonitor, IconSmartphone, IconTablet } from "../../../admin/_ui/icons";
import { ConfirmDialog, LIBRARY_BTN, LIBRARY_ERROR_RED } from "../../library/_ui/confirm-dialog";
import { revokeSessionAction } from "../actions";

/*
 * ADR-053 mục 4 — thẻ thiết bị đang đăng nhập (trang /account/security, khối "Phiên đăng nhập"). Mỗi thẻ: icon loại
 * thiết bị, nhãn trình duyệt · hệ điều hành, badge "Thiết bị này"/"Ghi nhớ", thời điểm đăng nhập + hoạt động gần nhất,
 * nút "Đăng xuất" có hộp thoại xác nhận (`confirmation-dialogs`). Kết quả báo ở một vùng `role="status"` chung của danh
 * sách (thẻ vừa đăng xuất biến mất sau revalidate nên không thể báo ngay trong thẻ). Lỗi hiện trong hộp thoại.
 */

export type DeviceKind = "desktop" | "mobile" | "tablet";

export interface SessionCardItem {
  id: string;
  deviceLabel: string;
  kind: DeviceKind;
  ip: string | null;
  startedIso: string;
  startedLabel: string;
  lastActiveIso: string;
  /** Tương đối ("12 phút trước"). */
  lastActiveLabel: string;
  /** Tuyệt đối, giờ Việt Nam — đọc kèm cho trình đọc màn hình. */
  lastActiveExact: string;
  rememberMe: boolean;
  isCurrent: boolean;
}

const RED = LIBRARY_ERROR_RED;
/** Viền thẻ — cùng giá trị `LINE` của trang Bảo mật. */
const LINE = "#E5E7EB";
/** Chữ xanh lá đạt ~5:1 trên nền #F0FDF4 (`secondary` chỉ ~3:1 — không dùng cho chữ thường). */
const SUCCESS = { fg: "#15803D", bg: "#F0FDF4", line: "#BBF7D0" };

const DEVICE_ICON: Record<DeviceKind, typeof IconMonitor> = { desktop: IconMonitor, mobile: IconSmartphone, tablet: IconTablet };
const DEVICE_NAME: Record<DeviceKind, string> = { desktop: "Máy tính", mobile: "Điện thoại", tablet: "Máy tính bảng" };

export function SessionCards({ items }: { items: SessionCardItem[] }) {
  const [status, setStatus] = useState("");
  const onlyCurrent = items.every((item) => item.isCurrent);

  return (
    <div className="space-y-3">
      <ul className="space-y-3" aria-label="Thiết bị đang đăng nhập">
        {items.map((item) => (
          <SessionCard key={item.id} item={item} onRevoked={setStatus} />
        ))}
      </ul>
      {onlyCurrent ? (
        <p className="text-sm" style={{ color: brandColors.inkSoft }}>
          Chỉ có thiết bị này đang đăng nhập.
        </p>
      ) : null}
      <p role="status" aria-atomic="true" className={status ? "rounded-lg border px-3.5 py-2.5 text-sm" : "sr-only"} style={status ? { background: SUCCESS.bg, borderColor: SUCCESS.line, color: SUCCESS.fg } : undefined}>
        {status}
      </p>
    </div>
  );
}

function SessionCard({ item, onRevoked }: { item: SessionCardItem; onRevoked: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const Icon = DEVICE_ICON[item.kind];

  function confirmRevoke() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", item.id);
      let signedOut = false;
      try {
        ({ signedOut } = await revokeSessionAction(formData));
      } catch {
        setError("Không đăng xuất được thiết bị này. Vui lòng thử lại.");
        return;
      }
      // Thiết bị này → điều hướng cứng về /login (ADR-053: xoá client cache phiên cũ, giữ `pending` tới khi trang mới
      // tải); thiết bị khác → thẻ biến mất sau revalidate.
      if (signedOut) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- ADR-053: điều hướng cứng có chủ đích.
        window.location.assign("/login");
        return;
      }
      if (!item.isCurrent) {
        setOpen(false);
        onRevoked(`Đã đăng xuất ${item.deviceLabel}.`);
      }
    });
  }

  return (
    <li
      className="flex flex-col gap-4 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:gap-5"
      style={{ borderColor: item.isCurrent ? brandColors.primary : LINE }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: brandColors.surface, color: brandColors.primary }}>
          <Icon className="h-6 w-6" />
          <span className="sr-only">{DEVICE_NAME[item.kind]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
              {item.deviceLabel}
            </p>
            {/* Badge `success` của kit (xanh lá trên nền xanh nhạt) chưa đạt 4.5:1 ở cỡ 12px → dùng `info`/`neutral`. */}
            {item.isCurrent ? <Badge tone="info">Thiết bị này</Badge> : null}
            {item.rememberMe ? <Badge tone="neutral">Ghi nhớ</Badge> : null}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm" style={{ color: brandColors.inkSoft }}>
            <div className="contents">
              <dt>Đăng nhập lúc</dt>
              <dd className="font-medium" style={{ color: brandColors.ink }}>
                <time dateTime={item.startedIso}>{item.startedLabel}</time>
              </dd>
            </div>
            <div className="contents">
              <dt>Hoạt động gần nhất</dt>
              <dd className="font-medium" style={{ color: brandColors.ink }}>
                <time dateTime={item.lastActiveIso} title={item.lastActiveExact}>
                  {item.lastActiveLabel}
                </time>
                <span className="sr-only"> ({item.lastActiveExact})</span>
              </dd>
            </div>
            {item.ip ? (
              <div className="contents">
                <dt>Địa chỉ IP</dt>
                <dd className="font-medium tabular-nums [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                  {item.ip}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`${LIBRARY_BTN} w-full shrink-0 border bg-white hover:bg-red-50 sm:w-auto`}
        style={{ borderColor: RED, color: RED }}
        aria-label={item.isCurrent ? "Đăng xuất thiết bị này" : `Đăng xuất ${item.deviceLabel}`}
      >
        Đăng xuất
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        busy={pending}
        title={item.isCurrent ? "Đăng xuất thiết bị này?" : "Đăng xuất thiết bị?"}
        description={
          item.isCurrent ? (
            <p>
              Bạn sẽ bị đăng xuất khỏi <strong className="font-semibold">thiết bị đang dùng</strong> ({item.deviceLabel}) và cần đăng nhập lại.
            </p>
          ) : (
            <p>
              Phiên đăng nhập trên <strong className="font-semibold">{item.deviceLabel}</strong> sẽ kết thúc ngay. Thiết bị này vẫn đăng nhập.
            </p>
          )
        }
        error={error}
        confirm={
          <button type="button" onClick={confirmRevoke} disabled={pending} className={`${LIBRARY_BTN} w-full text-white hover:brightness-110 sm:w-auto`} style={{ background: RED }}>
            {pending ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        }
        returnFocusRef={triggerRef}
      />
    </li>
  );
}
