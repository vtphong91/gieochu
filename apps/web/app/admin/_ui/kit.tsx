import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";

// Toggle/PasswordField dùng useState (hook) nên phải sống ở file "use client" riêng
// (kit.tsx này còn bị Server Component import thẳng, ví dụ admin/tenants/page.tsx —
// đưa hook vào đây sẽ vỡ build: "importing a module that depends on useState into
// a React Server Component module").
export { PasswordField, Toggle } from "./kit-interactive";

const RED = "#DC2626";
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";
const AMBER = "#B45309";
const AMBER_SOFT = "#FFFBEB";
const AMBER_LINE = "#FDE68A";
const GREEN_SOFT = "#F0FDF4";
const GREEN_LINE = "#BBF7D0";
const GRAY_LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";

/** Page header dùng chung mọi trang cấu hình/CMS: tiêu đề + mô tả + hành động phải. */
export function AdminPageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold" style={{ color: INK }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm" style={{ color: INK_SOFT }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Grid nhiều card cấu hình xếp ngang thay vì 1 cột hẹp — auto-fit tránh khoảng trắng chết. */
export function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 960px))" }}>{children}</div>;
}

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const BADGE_STYLE: Record<BadgeTone, { bg: string; fg: string; line: string }> = {
  success: { bg: GREEN_SOFT, fg: brandColors.secondary, line: GREEN_LINE },
  warning: { bg: AMBER_SOFT, fg: AMBER, line: AMBER_LINE },
  danger: { bg: RED_SOFT, fg: RED, line: RED_LINE },
  neutral: { bg: "#F3F4F6", fg: "#4B5563", line: GRAY_LINE },
  info: { bg: brandColors.surface, fg: brandColors.primary, line: "#BFDBFE" },
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const s = BADGE_STYLE[tone];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.fg, borderColor: s.line }}
    >
      {children}
    </span>
  );
}

/** Card cấu hình 1 phương thức/module: icon + tiêu đề + badge trạng thái + toggle bên phải. */
export function ConfigCard({
  icon,
  title,
  badges,
  description,
  toggle,
  children,
  footer,
}: {
  icon?: ReactNode;
  title: string;
  badges?: ReactNode;
  description?: string;
  toggle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: GRAY_LINE }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: brandColors.surface, color: brandColors.primary }}
            >
              {icon}
            </span>
          ) : null}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
                {title}
              </h2>
              {badges}
            </div>
            {description ? (
              <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {toggle ? <div className="shrink-0 pt-1">{toggle}</div> : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
      {footer ? (
        <div className="mt-5 border-t pt-4" style={{ borderColor: GRAY_LINE }}>
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function FieldShell({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

export function TextField({
  label,
  hint,
  error,
  id,
  ...rest
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  return (
    <FieldShell label={label} htmlFor={id!} hint={hint} error={error}>
      <input id={id} className={inputBase} style={{ borderColor: error ? RED : GRAY_LINE }} {...rest} />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string; hint?: string; error?: string }) {
  return (
    <FieldShell label={label} htmlFor={id!} hint={hint} error={error}>
      <select id={id} className={inputBase} style={{ borderColor: error ? RED : GRAY_LINE }} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function PrimaryButton({ children, loading, ...rest }: ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || rest.disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: brandColors.primary }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...rest }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: GRAY_LINE, color: INK }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Nút dạng Link (điều hướng qua query param, không cần state JS) — dùng cho các
 * khối "bấm để hiện form tạo mới" ẩn/hiện qua URL (?new=1) thay vì client component.
 */
export function PrimaryLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      style={{ background: brandColors.primary }}
    >
      {children}
    </Link>
  );
}

export function GhostLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50"
      style={{ borderColor: GRAY_LINE, color: INK }}
    >
      {children}
    </Link>
  );
}

type ActionTone = "primary" | "success" | "danger" | "neutral";

const ROW_ACTION_STYLE: Record<ActionTone, { bg: string; fg: string }> = {
  primary: { bg: brandColors.surface, fg: brandColors.primary },
  success: { bg: GREEN_SOFT, fg: brandColors.secondary },
  danger: { bg: RED_SOFT, fg: RED },
  neutral: { bg: "#F3F4F6", fg: "#4B5563" },
};

/** Nút hành động nhỏ trong dòng bảng — nền pastel theo ý nghĩa (đúng pattern `.admin-btn-action`). */
export function RowActionButton({ tone = "neutral", children, ...rest }: ComponentProps<"button"> & { tone?: ActionTone }) {
  const s = ROW_ACTION_STYLE[tone];
  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: s.bg, color: s.fg }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function FormBanner({ ok, message }: { ok: boolean; message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className="rounded-lg border px-3.5 py-2.5 text-sm"
      style={ok ? { background: GREEN_SOFT, borderColor: GREEN_LINE, color: brandColors.secondary } : { background: RED_SOFT, borderColor: RED_LINE, color: RED }}
    >
      {message}
    </p>
  );
}

/**
 * Bảng dữ liệu chuẩn — bọc trong khung bo góc, dùng lại ở mọi trang danh sách.
 * Cố tình KHÔNG set overflow-x-auto ở đây: set overflow-x mà bỏ overflow-y sẽ
 * khiến trình duyệt tự suy ra overflow-y:auto (quy tắc CSS overflow-x/y đi kèm
 * nhau) — vừa tạo thanh cuộn dọc thừa, vừa cắt mất RowMenu (position:absolute)
 * khi mở ở các hàng cuối bảng.
 */
export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white" style={{ borderColor: GRAY_LINE }}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: GRAY_LINE, color: INK_SOFT }}>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b last:border-0" style={{ borderColor: GRAY_LINE }}>
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}

/** Card bọc 1 bảng tham khảo/danh sách — icon + tiêu đề + mô tả, giống ConfigCard nhưng không có toggle. */
export function TableCard({
  icon,
  title,
  description,
  head,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  head: string[];
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: brandColors.surface, color: brandColors.primary }}>
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm" style={{ color: INK_SOFT }}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <DataTable head={head}>{children}</DataTable>
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed py-16 text-center" style={{ borderColor: GRAY_LINE }}>
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: brandColors.surface, color: brandColors.primary }}>
          {icon}
        </div>
      ) : null}
      <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
        {title}
      </p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: INK_SOFT }}>
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
