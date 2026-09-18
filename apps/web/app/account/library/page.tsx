import Link from "next/link";
import { requireCompleteAccountAccess } from "../../../lib/page-guards";
import { listLibraryEntitlements } from "../../../lib/library";
import { DownloadButton } from "./download-button";

/** §"M9": entitlements from every tenant, grouped by tenant. */
export default async function LibraryPage() {
  const user = await requireCompleteAccountAccess("/account/library");
  const groups = await listLibraryEntitlements(user.userId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Thư viện của bạn</h1>
        <Link href="/account/orders" className="text-sm text-[var(--color-primary)] underline">
          Lịch sử đơn hàng
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 text-gray-600">Bạn chưa có tài liệu nào.</p>
      ) : (
        groups.map((group) => (
          <section key={group.tenantId} className="mt-8">
            <h2 className="text-lg font-semibold">{group.tenantName}</h2>
            <ul className="mt-3 space-y-3">
              {group.entitlements.map((entitlement) => {
                const unlimited = entitlement.downloadLimit === 0;
                const remaining = unlimited ? null : Math.max(0, entitlement.downloadLimit - entitlement.downloadsUsed);
                const blocked = entitlement.revoked || (!unlimited && remaining === 0);
                return (
                  <li key={entitlement.entitlementId} className="rounded border p-4">
                    <div className="flex items-center justify-between">
                      <Link href={`/${group.tenantSlug}/products/${entitlement.productSlug}`} className="font-medium hover:underline">
                        {entitlement.productTitle}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {entitlement.revoked ? "Đã thu hồi" : unlimited ? "Không giới hạn lượt tải" : `Còn ${remaining} lượt tải`}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {entitlement.files.map((file) => (
                        <li key={file.id} className="flex items-center justify-between text-sm">
                          <span>{file.fileName}</span>
                          <DownloadButton fileId={file.id} disabled={blocked} />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
