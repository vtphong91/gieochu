import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { findPendingEmailChange } from "../../../lib/account-profile";
import { listAccountSessions } from "../../../lib/account-sessions";
import { AdminPageHeader } from "../../admin/_ui/kit";
import { IconLock, IconMail, IconShield } from "../../admin/_ui/icons";
import { ChangePasswordForm, EmailChangeSection, LogoutAllDevices } from "./security-forms";
import { SessionList } from "./session-list";

export const metadata: Metadata = { title: "Bảo mật", robots: { index: false, follow: false } };

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = "#E5E7EB";

/**
 * ADR-041 C3/C4 — Bảo mật: ba khối có neo `#mat-khau`, `#email`, `#phien` (deep link từ Hồ sơ/menu). `scroll-mt-24`
 * để neo không bị header dính (64px) che.
 */
export default async function SecurityPage() {
  const user = await requireVerifiedAccess("/account/security");
  const [dbUser, pendingEmail, sessions] = await Promise.all([
    getPrismaClient().user.findUniqueOrThrow({ where: { id: user.userId }, select: { email: true, hasPassword: true } }),
    findPendingEmailChange(user.userId),
    listAccountSessions(user),
  ]);

  return (
    <div>
      <AdminPageHeader title="Bảo mật" subtitle="Mật khẩu, email đăng nhập và các phiên đăng nhập của tài khoản." />

      {/* Từ xl: Đổi mật khẩu | Email đăng nhập (2 cột, cùng chiều cao); Phiên đăng nhập (khối nguy hiểm) trải hết hàng
          dưới — tách khỏi form thường (`destructive-emphasis`). Thứ tự DOM = thứ tự đọc. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* ADR-061 Q1: tài khoản tạo lúc mua chưa đặt mật khẩu → không có "mật khẩu hiện tại" để đổi; đặt qua email kích hoạt. */}
        {dbUser.hasPassword ? (
          <SecurityCard id="mat-khau" icon={<IconLock className="h-5 w-5" />} title="Đổi mật khẩu" description="Sau khi đổi, các thiết bị khác sẽ bị đăng xuất; thiết bị này vẫn đăng nhập.">
            <ChangePasswordForm />
          </SecurityCard>
        ) : (
          <SecurityCard
            id="mat-khau"
            icon={<IconLock className="h-5 w-5" />}
            title="Mật khẩu"
            description="Tài khoản được tạo khi bạn mua tài liệu và chưa có mật khẩu."
          >
            {/* Trạng thái "chưa đặt" bằng chữ + icon (không chỉ màu); nền `surface` = thông tin, không phải lỗi. */}
            <div className="flex gap-3 rounded-xl border border-l-4 p-4 text-sm leading-relaxed" style={{ background: brandColors.surface, borderColor: brandColors.primary, color: INK }}>
              <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: brandColors.primary }}>
                <IconMail className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">Chưa đặt mật khẩu</p>
                <p className="mt-1">
                  Mở email <strong className="font-semibold">“Kích hoạt tài khoản và đặt mật khẩu”</strong> gửi tới{" "}
                  <strong className="font-semibold [overflow-wrap:anywhere]">{dbUser.email}</strong> để đặt mật khẩu. Có mật khẩu rồi, bạn đăng nhập và tải lại
                  tài liệu được trên mọi thiết bị.
                </p>
              </div>
            </div>
            <p className="mt-4">
              <Link
                href="/verify-email?pending=1"
                className="inline-flex min-h-11 items-center justify-center rounded-full border bg-white px-5 text-sm font-semibold text-[color:var(--color-primary)] transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] motion-reduce:transition-none"
                style={{ borderColor: brandColors.primary }}
              >
                Gửi lại email kích hoạt
              </Link>
            </p>
          </SecurityCard>
        )}

        <SecurityCard id="email" icon={<IconMail className="h-5 w-5" />} title="Email đăng nhập" description="Đổi email cần xác minh qua link gửi tới email mới.">
          <EmailChangeSection currentEmail={dbUser.email} pendingEmail={pendingEmail} />
        </SecurityCard>

        <SecurityCard
          id="phien"
          icon={<IconShield className="h-5 w-5" />}
          title="Phiên đăng nhập"
          description="Nếu nghi ngờ ai đó đang dùng tài khoản của bạn, hãy đổi mật khẩu rồi đăng xuất khỏi mọi thiết bị."
          danger
          className="xl:col-span-2"
        >
          {/* ADR-053 mục 4: thiết bị đang đăng nhập + đăng xuất từng thiết bị. */}
          <div className="mb-4">
            <SessionList sessions={sessions} />
          </div>
          <LogoutAllDevices />
        </SecurityCard>
      </div>
    </div>
  );
}

function SecurityCard({
  id,
  icon,
  title,
  description,
  danger = false,
  className = "",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  danger?: boolean;
  /** Vị trí trong lưới trang (vd `xl:col-span-2`). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`min-w-0 scroll-mt-24 rounded-2xl border bg-white p-5 sm:p-6 ${className}`} style={{ borderColor: danger ? "#FCA5A5" : LINE }}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={danger ? { background: "#FEF2F2", color: "#B91C1C" } : { background: brandColors.surface, color: brandColors.primary }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
            {title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
            {description}
          </p>
        </div>
      </div>
      {/* Card fluid → giới hạn chiều rộng *nội dung form*, không giới hạn khung trang. */}
      <div className="mt-5 max-w-3xl">{children}</div>
    </section>
  );
}
