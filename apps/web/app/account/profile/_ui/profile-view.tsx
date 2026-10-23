import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { AccountOverview } from "../../../../lib/account-profile";
import { AdminPageHeader, Badge } from "../../../admin/_ui/kit";
import { IconCheckCircle, IconMail } from "../../../admin/_ui/icons";
import { formatVnDateTime } from "../../_ui/format";
import { AvatarCard } from "../avatar-card";
import { ProfileForm } from "../profile-form";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
const CARD = "min-w-0 rounded-2xl border bg-white p-5 sm:p-6";

/** ADR-041 C2 — Hồ sơ: ảnh đại diện · thông tin cá nhân (họ tên, SĐT, Tỉnh/Thành) · email đăng nhập (chỉ đọc). */
export function ProfileView({ overview, avatarMaxBytes }: { overview: AccountOverview; avatarMaxBytes: number }) {
  const displayName = overview.fullName.trim() || overview.email;

  return (
    <div>
      <AdminPageHeader title="Hồ sơ" subtitle="Thông tin cá nhân của tài khoản — dùng chung khi bạn mua tài liệu và khi quản lý gian hàng." />

      {/* Từ xl: Ảnh đại diện (cột hẹp) | Thông tin cá nhân (cột rộng); Email đăng nhập trải hết hàng dưới. Thứ tự DOM =
          thứ tự đọc (trái → phải → xuống). Thẻ cùng hàng kéo bằng chiều cao. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <AvatarCard initialUrl={overview.avatarUrl} displayName={displayName} maxBytes={avatarMaxBytes} uploadEnabled={overview.avatarUploadEnabled} />

        <section aria-labelledby="personal-title" className={CARD} style={{ borderColor: LINE }}>
          <h2 id="personal-title" className="mb-4 font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
            Thông tin cá nhân
          </h2>
          <ProfileForm saved={{ fullName: overview.fullName, phone: overview.phone ?? "", province: overview.province ?? "" }} />
        </section>

        <section aria-labelledby="login-email-title" className={`${CARD} xl:col-span-2`} style={{ borderColor: LINE }}>
          <h2 id="login-email-title" className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
            Email đăng nhập
          </h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium" style={{ color: INK }}>
                <span className="[overflow-wrap:anywhere]">{overview.email}</span>
                {overview.emailVerifiedAt ? (
                  <Badge tone="success">
                    <IconCheckCircle className="mr-1 h-3.5 w-3.5" />
                    Đã xác minh
                  </Badge>
                ) : null}
              </p>
              <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
                Dùng để đăng nhập và nhận thông báo đơn hàng.
              </p>
            </div>
            <Link
              href="/account/security#email"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 text-sm font-semibold outline-offset-2 hover:bg-gray-50 focus-visible:outline-2 lg:min-h-10"
              style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
            >
              Đổi email
            </Link>
          </div>
          {overview.pendingEmail ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: brandColors.surface, color: BLUE }}>
              <IconMail className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Đang chờ xác minh <strong className="font-semibold [overflow-wrap:anywhere]">{overview.pendingEmail.email}</strong> — hết hạn lúc{" "}
                {formatVnDateTime(overview.pendingEmail.expiresAt)}. Email hiện tại vẫn dùng để đăng nhập tới khi xác minh xong.
              </span>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
