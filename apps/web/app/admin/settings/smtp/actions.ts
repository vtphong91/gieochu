"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { createSmtpSender } from "@gieochu/email";
import { requireRole } from "../../../../lib/session";
import { saveSystemSmtpConfig, testSystemSmtpConnection, getDecryptedSystemSmtpConfig } from "../../../../lib/system-smtp";
import { logEmailSend } from "../../../../lib/email-dispatch";
import { getEffectiveBrand } from "../../../../lib/branding";

export interface SmtpActionState {
  error?: string;
  success?: boolean;
  testResult?: { ok: boolean; message?: string };
}

const smtpSchema = z.object({
  host: z.string().trim().min(1, "Thiếu SMTP host."),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.enum(["true", "false"]).transform((v) => v === "true"),
  username: z.string().trim().min(1, "Thiếu tên đăng nhập."),
  fromName: z.string().trim().min(1, "Thiếu tên người gửi."),
  fromEmail: z.string().trim().email("Email người gửi không hợp lệ."),
  replyTo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().email("Reply-To không hợp lệ.").optional()),
});

export async function saveSmtpConfigAction(_prevState: SmtpActionState, formData: FormData): Promise<SmtpActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = smtpSchema.safeParse({
    host: formData.get("host"),
    port: formData.get("port"),
    secure: formData.get("secure"),
    username: formData.get("username"),
    fromName: formData.get("fromName"),
    fromEmail: formData.get("fromEmail"),
    replyTo: formData.get("replyTo") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const password = String(formData.get("password") ?? "").trim();

  try {
    await saveSystemSmtpConfig({
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: parsed.data,
      secrets: { password },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/settings/smtp");
  return { success: true };
}

export async function testSmtpConnectionAction(): Promise<SmtpActionState> {
  await requireRole("SYSTEM_ADMIN");
  const result = await testSystemSmtpConnection();
  revalidatePath("/admin/settings/smtp");
  return { testResult: result };
}

const TEST_EMAIL_TYPE = "smtp_test";

export async function sendTestEmailAction(_prevState: SmtpActionState, formData: FormData): Promise<SmtpActionState> {
  await requireRole("SYSTEM_ADMIN");
  const to = z.string().trim().email("Địa chỉ email không hợp lệ.").safeParse(formData.get("to"));
  if (!to.success) return { error: to.error.issues[0]?.message ?? "Địa chỉ email không hợp lệ." };

  const config = await getDecryptedSystemSmtpConfig();
  if (!config) return { error: "SMTP chưa được cấu hình hoặc đang tắt — lưu và xác minh kết nối trước." };

  const brand = await getEffectiveBrand();
  const subject = `Email test SMTP từ ${brand.name}`;
  const html = "<p>Đây là email test xác nhận cấu hình SMTP đang hoạt động đúng.</p>";
  const text = "Đây là email test xác nhận cấu hình SMTP đang hoạt động đúng.";

  try {
    const sender = createSmtpSender({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.username, pass: config.password },
      from: `${config.fromName} <${config.fromEmail}>`,
      replyTo: config.replyTo || undefined,
    });
    await sender.send({ type: TEST_EMAIL_TYPE, to: to.data, subject, html, text });
    await logEmailSend({ type: TEST_EMAIL_TYPE, recipient: to.data, subject, status: "SENT" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gửi thất bại.";
    await logEmailSend({ type: TEST_EMAIL_TYPE, recipient: to.data, subject, status: "FAILED", errorMessage: message });
    return { error: `Gửi thất bại: ${message}` };
  }
  revalidatePath("/admin/settings/smtp");
  return { success: true };
}
