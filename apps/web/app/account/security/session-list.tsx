import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { AccountSessionView } from "../../../lib/account-sessions";
import { SessionCards, type SessionCardItem } from "./_ui/session-cards";

const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "vừa xong" / "12 phút trước" / "3 giờ trước" / "hôm qua"; quá 7 ngày → ngày giờ tuyệt đối (giờ Việt Nam). */
function formatRelative(date: Date, now: number): string {
  const diff = now - date.getTime();
  if (diff < MINUTE) return "vừa xong";
  if (diff < HOUR) return relative.format(-Math.floor(diff / MINUTE), "minute");
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), "hour");
  if (diff < 7 * DAY) return relative.format(-Math.floor(diff / DAY), "day");
  return dateTime.format(date);
}

/** Chuẩn bị dữ liệu hiển thị. Mốc "bây giờ" lấy ở server, mỗi request một lần (Server Component không re-render). */
function toCardItems(sessions: AccountSessionView[]): SessionCardItem[] {
  const now = Date.now();
  return [...sessions]
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
    .map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      kind: session.deviceKind,
      ip: session.ip,
      startedIso: session.startedAt.toISOString(),
      startedLabel: dateTime.format(session.startedAt),
      lastActiveIso: session.lastActiveAt.toISOString(),
      lastActiveLabel: formatRelative(session.lastActiveAt, now),
      lastActiveExact: dateTime.format(session.lastActiveAt),
      rememberMe: session.rememberMe,
      isCurrent: session.isCurrent,
    }));
}

/**
 * ADR-053 mục 4 — danh sách thiết bị đang đăng nhập. Server định dạng ngày giờ (`Asia/Ho_Chi_Minh`, tránh lệch
 * hydrate), phần tương tác (xác nhận, pending, lỗi, thông báo) ở `SessionCards`. Thiết bị này luôn đứng đầu.
 */
export function SessionList({ sessions }: { sessions: AccountSessionView[] }) {
  return <SessionCards items={toCardItems(sessions)} />;
}
