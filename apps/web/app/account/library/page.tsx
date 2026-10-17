import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listLibraryEntitlements } from "../../../lib/library";
import { LibraryEntitlementCard } from "./_ui/library-entitlement-card";
import { LIBRARY_FOCUS } from "./_ui/confirm-dialog";

/** §"M9": entitlements from every tenant, grouped by tenant. ADR-039: thẻ tài liệu bị gỡ do vi phạm có khối lựa chọn. */
export default async function LibraryPage() {
  const user = await requireVerifiedAccess("/account/library");
  const groups = await listLibraryEntitlements(user.userId);
  const pendingChoices = groups.reduce(
    (sum, group) => sum + group.entitlements.filter((e) => !e.revoked && e.remedyStatus === "PENDING_CHOICE").length,
    0,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold">Thư viện của bạn</h1>
        <Link href="/account/orders" className={`inline-flex min-h-11 items-center rounded text-sm text-[var(--color-primary)] underline lg:min-h-0 ${LIBRARY_FOCUS}`}>
          Lịch sử đơn hàng
        </Link>
      </div>

      {pendingChoices > 0 ? (
        <p className="mt-4 rounded-xl border border-l-4 p-4 text-sm leading-relaxed" style={{ borderColor: brandColors.accent, background: brandColors.accentSoft, color: brandColors.ink }}>
          <strong className="font-semibold">Có {pendingChoices} tài liệu cần bạn lựa chọn.</strong> Tài liệu đã bị gỡ do vi phạm chính sách — xem khung thông
          báo ở từng tài liệu bên dưới.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed px-4 py-12 text-center" style={{ borderColor: "#E5E7EB" }}>
          <p className="font-semibold">Bạn chưa có tài liệu nào.</p>
          <p className="mt-1 text-sm text-gray-600">Tài liệu bạn mua sẽ xuất hiện ở đây để tải xuống.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.tenantId} className="mt-8" aria-labelledby={`library-tenant-${group.tenantId}`}>
            <h2 id={`library-tenant-${group.tenantId}`} className="text-lg font-semibold [overflow-wrap:anywhere]">
              {group.tenantName}
            </h2>
            <ul className="mt-3 space-y-3">
              {group.entitlements.map((entitlement) => (
                <LibraryEntitlementCard key={entitlement.entitlementId} entitlement={entitlement} tenantName={group.tenantName} tenantSlug={group.tenantSlug} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
