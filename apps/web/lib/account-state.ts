import { unstable_rethrow } from "next/navigation";
import { AppError, ErrorCodes, logger } from "@gieochu/core";

/**
 * ADR-041 mục C — state chung trả về `useActionState` cho mọi Server Action ở `/account/*` (thay redirect + query).
 *
 * - `ok: true` → `message` (tiếng Việt, hiện ở banner `role="status"`) + dữ liệu phụ tuỳ action.
 * - `ok: false` → `code` (mã máy đọc), `formError` (lỗi chung, banner `role="alert"`), `fieldErrors` (khoá = `name`
 *   của ô), `values` (giá trị người dùng đã gõ — form uncontrolled bị React reset sau submit, UI dùng làm
 *   `defaultValue` để không mất nội dung). Không bao giờ chứa mật khẩu.
 */
export type AccountActionState<TData extends object = Record<never, never>> =
  | ({ ok: true; message: string } & TData)
  | {
      ok: false;
      code: string;
      formError?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | null;

export type AccountActionFailure = Extract<AccountActionState, { ok: false }>;

export function accountFailure(
  code: string,
  formError?: string,
  extra: { fieldErrors?: Record<string, string>; values?: Record<string, string> } = {},
): AccountActionFailure {
  return { ok: false, code, ...(formError ? { formError } : {}), ...extra };
}

/**
 * Lỗi ném ra trong action → state. `AppError` hiển thị được (chưa đăng nhập, chưa xác minh, rate limit...) → message
 * của nó; lỗi nội bộ Next (redirect/notFound/dynamic) → ném tiếp; lỗi khác → log + thông báo chung.
 */
export function accountErrorState(error: unknown, context: string): AccountActionFailure {
  unstable_rethrow(error);
  if (error instanceof AppError && error.expose) {
    return accountFailure(error.code, error.message);
  }
  logger.error({ err: error, context }, "account: action thất bại");
  return accountFailure(ErrorCodes.INTERNAL_ERROR, "Đã xảy ra lỗi. Vui lòng thử lại sau.");
}

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
