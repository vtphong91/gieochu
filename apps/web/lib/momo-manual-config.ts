import { momoManualProvider, normalizeMomoManualConfig } from "@gieochu/payments";

/**
 * ADR-059 bổ sung lần 3 — đọc form "MoMo cá nhân (xác nhận tay)" (Studio + System Center dùng chung): chuẩn hoá (số điện thoại
 * 0xxxxxxxxx, tên VIẾT HOA không dấu) rồi kiểm bằng schema của provider. Lỗi trả câu tiếng
 * Việt theo trường đầu tiên sai — không ném.
 */
export type MomoManualFormResult =
  | { ok: true; config: { phone: string; accountName: string } }
  | { ok: false; error: string };

export function readMomoManualForm(formData: FormData): MomoManualFormResult {
  const config = normalizeMomoManualConfig({
    phone: String(formData.get("phone") ?? ""),
    accountName: String(formData.get("accountName") ?? ""),
  });
  try {
    momoManualProvider.validateConfig(config);
  } catch (error) {
    // ZodError (kiểm theo hình dạng — không phụ thuộc bản zod của package nào tạo ra lỗi).
    const issues = (error as { issues?: { message?: string }[] }).issues;
    return { ok: false, error: issues?.[0]?.message ?? "Cấu hình không hợp lệ." };
  }
  return { ok: true, config };
}
