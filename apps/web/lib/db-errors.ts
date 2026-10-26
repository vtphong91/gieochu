/**
 * ADR-059 bổ sung lần 3: DB chưa có giá trị enum mà code đã biết (vd `MOMO_MANUAL` trước khi áp migration
 * `20261026150000_adr059_momo_manual`) — Postgres 22P02 "invalid input value for enum". Dùng để báo lỗi rõ / coi như rỗng thay
 * vì 500 trong khoảng code lên trước migration.
 */
export function isMissingEnumValueError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /invalid input value for enum/i.test(text) || /22P02/.test(text);
}

export const MOMO_MANUAL_NOT_READY_MESSAGE =
  "Hệ thống chưa sẵn sàng cho MoMo cá nhân (cơ sở dữ liệu chưa được cập nhật). Vui lòng thử lại sau hoặc liên hệ quản trị.";
