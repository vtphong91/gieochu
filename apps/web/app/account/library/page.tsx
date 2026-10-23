import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listLibraryEntitlements } from "../../../lib/library";
import { LibraryEntitlementCard } from "./_ui/library-entitlement-card";
import { LIBRARY_FOCUS } from "./_ui/confirm-dialog";
import { AdminPageHeader, EmptyState } from "../../admin/_ui/kit";
import { IconPackage } from "../../admin/_ui/icons";

/** §"M9": entitlements from every tenant, grouped by tenant. ADR-039: thẻ tài liệu bị gỡ do vi phạm có khối lựa chọn. */
export default async function LibraryPage() {
  const user = await requireVerifiedAccess("/account/library");
  const groups = await listLibraryEntitlements(user.userId);
  const pendingChoices = groups.reduce(
    (sum, group) => sum + group.entitlements.filter((e) => !e.revoked && e.remedyStatus === "PENDING_CHOICE").length,
    0,
  );

  return (
    <div>
      <AdminPageHeader
        title="Thư viện của bạn"
        subtitle="Tài liệu đã mua ở mọi gian hàng, nhóm theo gian hàng — tải xuống bất cứ lúc nào."
        action={
          <Link href="/account/orders" className={`inline-flex min-h-11 items-center rounded text-sm text-[var(--color-primary)] underline lg:min-h-0 ${LIBRARY_FOCUS}`}>
            Lịch sử đơn hàng
          </Link>
        }
      />

      {pendingChoices > 0 ? (
        <p className="mt-4 rounded-xl border border-l-4 p-4 text-sm leading-relaxed" style={{ borderColor: brandColors.accent, background: brandColors.accentSoft, color: brandColors.ink }}>
          <strong className="font-semibold">Có {pendingChoices} tài liệu cần bạn lựa chọn.</strong> Tài liệu đã bị gỡ do vi phạm chính sách — xem khung thông
          báo ở từng tài liệu bên dưới.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconPackage className="h-6 w-6" />}
            title="Bạn chưa có tài liệu nào"
            description="Tài liệu bạn mua sẽ xuất hiện ở đây để tải xuống."
            action={
              <Link
                href="/cua-hang"
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white hover:brightness-110 ${LIBRARY_FOCUS}`}
                style={{ background: brandColors.primary }}
              >
                Khám phá tài liệu
              </Link>
            }
          />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.tenantId} className="mt-8" aria-labelledby={`library-tenant-${group.tenantId}`}>
            <h2 id={`library-tenant-${group.tenantId}`} className="text-lg font-semibold [overflow-wrap:anywhere]">
              {group.tenantName}
            </h2>
            {/* Từ xl: 2 cột thẻ (thẻ cùng hàng kéo bằng chiều cao) — tận dụng chiều rộng vùng main. */}
            <ul className="mt-3 grid gap-3 xl:grid-cols-2">
              {group.entitlements.map((entitlement) => (
                <LibraryEntitlementCard key={entitlement.entitlementId} entitlement={entitlement} tenantName={group.tenantName} tenantSlug={group.tenantSlug} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
