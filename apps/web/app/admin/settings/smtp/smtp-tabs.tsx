"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveSmtpConfigAction, sendTestEmailAction, testSmtpConnectionAction, type SmtpActionState } from "./actions";
import { Badge, FormBanner, GhostButton, PasswordField, PrimaryButton, TextField } from "../../_ui/kit";
import { IconLock } from "../../_ui/icons";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";
import { InPageTabs } from "../../_ui/in-page-tabs";

const TABS = [
  { id: "config", label: "Cấu hình" },
  { id: "test", label: "Kiểm tra & Kích hoạt" },
  { id: "history", label: "Lịch sử gửi" },
] as const;


export interface SmtpInitial {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isEnabled: boolean;
  maskedPassword?: string;
  lastVerifiedAt: string | null;
}

export interface EmailLogRow {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

const PORT_PRESETS = [
  { port: 465, secure: true, label: "465" },
  { port: 587, secure: false, label: "587" },
  { port: 25, secure: false, label: "25" },
];

/**
 * Tab nội bộ SMTP — `InPageTabs` (tab ARIA thật, kiểu pill, ADR-058). Cả 3 panel luôn mounted, chỉ `hidden`: nếu unmount
 * ConfigTab khi rời tab, state cục bộ port/secure (chọn qua nút 465/587/25) sẽ mất khi quay lại, âm thầm trả về giá trị đã
 * lưu trước đó dù người dùng chưa bấm "Lưu cấu hình" (bug thật đã gặp: chọn SSL 465 → xem tab khác → quay lại → tự động về
 * STARTTLS 587).
 */
export function SmtpTabs({ initial, log }: { initial: SmtpInitial; log: EmailLogRow[] }) {
  const panels: Record<(typeof TABS)[number]["id"], React.ReactNode> = {
    config: <ConfigTab initial={initial} />,
    test: <TestTab initial={initial} />,
    history: <HistoryTab log={log} />,
  };
  return (
    <div className="mt-6">
      <InPageTabs label="Cấu hình Email (SMTP)" tabs={TABS.map((t) => ({ id: t.id, label: t.label, panel: panels[t.id] }))} />
    </div>
  );
}

/** Giá trị form cấu hình (trừ port/secure — 2 trường này là state). Dùng để biết "có thay đổi chưa lưu". */
type SmtpFormValues = { isEnabled: boolean; fromEmail: string; fromName: string; replyTo: string; host: string; username: string; password: string };

function readSmtpForm(form: HTMLFormElement): SmtpFormValues {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  return {
    isEnabled: data.get("isEnabled") !== null,
    fromEmail: text("fromEmail"),
    fromName: text("fromName"),
    replyTo: text("replyTo"),
    host: text("host"),
    username: text("username"),
    password: text("password"),
  };
}

/**
 * Ghi lại giá trị đã gửi vào các ô sau khi React reset form (task 1.8b) — KHÔNG ghi ô mật khẩu: để trống = giữ mật khẩu
 * đã lưu (nghiệp vụ hiện có), và không đưa secret vừa gõ trở lại DOM.
 */
function restoreSmtpForm(form: HTMLFormElement, values: SmtpFormValues) {
  const field = (name: string) => form.elements.namedItem(name);
  const enabled = field("isEnabled");
  if (enabled instanceof HTMLInputElement) enabled.checked = values.isEnabled;
  for (const name of ["fromEmail", "fromName", "replyTo", "host", "username"] as const) {
    const input = field(name);
    if (input instanceof HTMLInputElement) input.value = values[name];
  }
}

function sameValues(a: SmtpFormValues, b: SmtpFormValues) {
  return (Object.keys(a) as (keyof SmtpFormValues)[]).every((key) => a[key] === b[key]);
}

function ConfigTab({ initial }: { initial: SmtpInitial }) {
  const [state, formAction, isPending] = useActionState<SmtpActionState, FormData>(saveSmtpConfigAction, {});
  const [port, setPort] = useState(initial.port || 587);
  const [secure, setSecure] = useState(initial.secure);

  // ADR-058 mục 5 — theo dõi "có thay đổi chưa lưu" phía client (form không kiểm soát → đọc FormData khi có thay đổi).
  // Mốc = giá trị đang hiển thị lúc tải (khớp `defaultValue`); lưu thành công → mốc = giá trị vừa gửi (mật khẩu rỗng).
  // Task 1.8b — React 19 reset ô không kiểm soát sau MỌI lần action chạy xong, kể cả khi action trả lỗi → mất dữ liệu đã
  // gõ. Chụp giá trị lúc `onSubmit`, sau khi reset ghi lại vào ô (trừ mật khẩu). Thành công thì giá trị đó cũng chính là
  // giá trị đã lưu nên ghi lại vô hại; lỗi thì người dùng sửa tiếp được, chỉ cần gõ lại mật khẩu nếu đã nhập.
  const initialValues: SmtpFormValues = {
    isEnabled: initial.isEnabled,
    fromEmail: initial.fromEmail,
    fromName: initial.fromName,
    replyTo: initial.replyTo,
    host: initial.host || "smtp.gmail.com",
    username: initial.username,
    password: "",
  };
  const [values, setValues] = useState<SmtpFormValues>(initialValues);
  const [savedValues, setSavedValues] = useState<SmtpFormValues>(initialValues);
  const [savedTransport, setSavedTransport] = useState({ port: initial.port || 587, secure: initial.secure });
  const [submitted, setSubmitted] = useState<{ values: SmtpFormValues; port: number; secure: boolean } | null>(null);
  // Bản chụp cho trình xử lý `reset` (chạy ngoài render) — chỉ ghi/đọc trong event handler.
  const submittedRef = useRef<SmtpFormValues | null>(null);
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success && submitted) {
      setSavedValues({ ...submitted.values, password: "" });
      setSavedTransport({ port: submitted.port, secure: submitted.secure });
    }
  }
  const dirty = !sameValues(values, savedValues) || port !== savedTransport.port || secure !== savedTransport.secure;
  useUnsavedChanges(dirty, "Cấu hình SMTP có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  return (
    <form
      action={formAction}
      className="space-y-5"
      onChange={(event) => setValues(readSmtpForm(event.currentTarget))}
      onSubmit={(event) => {
        const snapshot = readSmtpForm(event.currentTarget);
        submittedRef.current = snapshot;
        setSubmitted({ values: snapshot, port, secure });
      }}
      onReset={(event) => {
        const form = event.currentTarget;
        const snapshot = submittedRef.current;
        submittedRef.current = null;
        // Sự kiện `reset` chạy TRƯỚC khi trình duyệt khôi phục giá trị → ghi lại/đọc ở tick sau.
        window.setTimeout(() => {
          if (snapshot) restoreSmtpForm(form, snapshot);
          setValues(readSmtpForm(form));
        }, 0);
      }}
    >
      <input type="hidden" name="port" value={port} />
      <input type="hidden" name="secure" value={secure ? "true" : "false"} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
                Người gửi
              </p>
              <p className="text-sm text-gray-500">Tên và địa chỉ email hiển thị trong hộp thư người nhận.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium" style={{ color: "#12213A" }}>
              <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} className="h-4 w-4" />
              Bật
            </label>
          </div>

          <div className="space-y-4">
            <TextField
              id="smtp-fromEmail"
              label="From Email"
              name="fromEmail"
              type="email"
              defaultValue={initial.fromEmail}
              hint="Gmail yêu cầu trùng (hoặc là alias của) địa chỉ đăng nhập."
              required
            />
            <TextField id="smtp-fromName" label="From Name" name="fromName" defaultValue={initial.fromName} required />
            <TextField
              id="smtp-replyTo"
              label="Reply-To"
              name="replyTo"
              type="email"
              defaultValue={initial.replyTo}
              hint="Tuỳ chọn — địa chỉ nhận phản hồi, để trống nếu dùng From Email."
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border px-3.5 py-3" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-xs text-gray-500">Test kết nối gần nhất</p>
              <p className="mt-1 text-sm font-medium" style={{ color: "#12213A" }}>
                {initial.lastVerifiedAt ?? "Chưa kiểm tra"}
              </p>
            </div>
            <div className="rounded-lg border px-3.5 py-3" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-xs text-gray-500">Trạng thái</p>
              <p className="mt-1">
                <Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang hoạt động" : "Đang tắt"}</Badge>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
          <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
            Kết nối SMTP
          </p>
          <p className="mb-4 text-sm text-gray-500">Mật khẩu được mã hoá AES-256-GCM, không bao giờ trả về client.</p>

          <div className="space-y-4">
            <TextField id="smtp-host" label="Host" name="host" defaultValue={initial.host || "smtp.gmail.com"} required />

            <div>
              <label htmlFor="smtp-port-input" className="block text-sm font-medium" style={{ color: "#12213A" }}>
                Port
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="smtp-port-input"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || 0)}
                  className="w-28 rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
                  style={{ borderColor: "#E5E7EB" }}
                />
                <div className="flex gap-1.5">
                  {PORT_PRESETS.map((preset) => (
                    <button
                      key={preset.port}
                      type="button"
                      onClick={() => {
                        setPort(preset.port);
                        setSecure(preset.secure);
                      }}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition"
                      style={
                        port === preset.port
                          ? { borderColor: "#0F3B82", color: "#0F3B82", background: "#EFF6FF" }
                          : { borderColor: "#E5E7EB", color: "#6B7280" }
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">587 = STARTTLS · 465 = SSL/TLS</p>
            </div>

            <div>
              <span className="block text-sm font-medium" style={{ color: "#12213A" }}>
                Mã hoá TLS
              </span>
              <div className="mt-1.5 flex gap-4">
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={!secure} onChange={() => setSecure(false)} />
                  false (STARTTLS)
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="radio" checked={secure} onChange={() => setSecure(true)} />
                  true (SSL/TLS)
                </label>
              </div>
            </div>

            <TextField id="smtp-username" label="Username" name="username" defaultValue={initial.username} required autoComplete="off" />
            <PasswordField
              id="smtp-password"
              label="Password"
              name="password"
              placeholder={initial.maskedPassword ? `Hiện tại: ${initial.maskedPassword} — để trống nếu giữ nguyên` : "App Password"}
            />
          </div>

          <div className="mt-5 rounded-lg border px-3.5 py-3 text-xs" style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}>
            <p className="font-semibold">Gmail — App Password</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
              <li>Bật xác thực 2 bước tại myaccount.google.com</li>
              <li>Security → App passwords → tạo mật khẩu 16 ký tự</li>
              <li>Host: smtp.gmail.com · Port: 587 · Secure: false</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <IconLock className="h-3.5 w-3.5 shrink-0" /> Mật khẩu được mã hoá AES-256-GCM trước khi lưu vào DB.
        </p>
        <div className="flex items-center gap-3">
          {dirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
          <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
        </div>
      </div>
    </form>
  );
}

function TestTab({ initial }: { initial: SmtpInitial }) {
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isVerifying, startVerify] = useTransition();
  const [sendState, sendAction, isSending] = useActionState<SmtpActionState, FormData>(sendTestEmailAction, {});

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
          <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
            Kiểm tra kết nối
          </p>
          <p className="mb-4 text-sm text-gray-500">Đăng nhập SMTP thật để xác minh host/port/username/password — không gửi email.</p>

          <div className="mb-4 rounded-lg border px-3.5 py-3" style={{ borderColor: "#E5E7EB" }}>
            <p className="text-xs text-gray-500">Test gần nhất</p>
            <p className="mt-1 text-sm font-medium" style={{ color: "#12213A" }}>
              {initial.lastVerifiedAt ?? "Chưa kiểm tra"}
            </p>
          </div>

          <GhostButton
            disabled={isVerifying}
            onClick={() =>
              startVerify(async () => {
                const result = await testSmtpConnectionAction();
                setVerifyResult(result.testResult ?? null);
              })
            }
          >
            {isVerifying ? "Đang kiểm tra..." : "Kiểm tra kết nối SMTP"}
          </GhostButton>
          {verifyResult ? (
            <div className="mt-3">
              <FormBanner ok={verifyResult.ok} message={verifyResult.ok ? "Kết nối thành công." : (verifyResult.message ?? "Kết nối thất bại.")} />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
          <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
            Gửi email test
          </p>
          <p className="mb-4 text-sm text-gray-500">Gửi một email mẫu thật đến địa chỉ tuỳ chọn để xác nhận toàn bộ luồng gửi hoạt động đúng.</p>

          <form action={sendAction} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <TextField id="smtp-test-to" label="Gửi đến" name="to" type="email" placeholder="ban@example.com" required />
            </div>
            <div className="sm:pt-7">
              <PrimaryButton loading={isSending}>{isSending ? "Đang gửi..." : "Gửi"}</PrimaryButton>
            </div>
          </form>
          {sendState.error || sendState.success ? (
            <div className="mt-3">
              <FormBanner ok={Boolean(sendState.success)} message={sendState.error ?? "Đã gửi — kiểm tra hộp thư (và mục spam)."} />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-2xl border px-5 py-4"
        style={
          initial.isEnabled
            ? { borderColor: "#BBF7D0", background: "#F0FDF4", color: "#166534" }
            : { borderColor: "#E5E7EB", background: "#F9FAFB", color: "#4B5563" }
        }
      >
        <p className="font-semibold">{initial.isEnabled ? "SMTP đang hoạt động" : "SMTP chưa được kích hoạt"}</p>
        <p className="mt-0.5 text-sm opacity-90">
          {initial.isEnabled
            ? "Toàn bộ email hệ thống (xác thực, reset mật khẩu, thông báo billing...) đang được gửi qua cấu hình SMTP này."
            : "Lưu cấu hình và kiểm tra kết nối thành công để kích hoạt — trong lúc chờ, hệ thống dùng cấu hình email mặc định (env)."}
        </p>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { SENT: "Đã gửi", FAILED: "Thất bại" };

function HistoryTab({ log }: { log: EmailLogRow[] }) {
  if (log.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center" style={{ borderColor: "#E5E7EB" }}>
        <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
          Chưa có email nào được gửi
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          Lịch sử chỉ ghi lại email cấp hệ thống (xác thực, reset mật khẩu, billing...) — không bao gồm email gửi tới khách hàng của tenant.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">50 email gần nhất — chỉ email cấp hệ thống, không gồm email gửi tới khách hàng của tenant.</p>
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "#E5E7EB", color: "#6B7280" }}>
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium">Gửi đến</th>
              <th className="px-4 py-3 font-medium">Tiêu đề</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {log.map((row) => (
              <tr key={row.id} className="border-b last:border-0" style={{ borderColor: "#E5E7EB" }}>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">{row.createdAt}</td>
                <td className="px-4 py-3">
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{row.type}</code>
                </td>
                <td className="px-4 py-3">{row.recipient}</td>
                <td className="px-4 py-3 max-w-[280px] truncate" title={row.subject}>
                  {row.subject}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={row.status === "SENT" ? "success" : "danger"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                  {row.status === "FAILED" && row.errorMessage ? (
                    <p className="mt-1 max-w-[240px] text-xs text-gray-500">{row.errorMessage}</p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
