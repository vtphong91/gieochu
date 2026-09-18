import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { requireTenantMemberPage } from "../../../../../../lib/page-guards";
import { getProduct } from "../../../../../../lib/product";
import { listShareLinks } from "../../../../../../lib/share-link";
import { ShareLinkForm } from "./share-link-form";
import { RevokeButton } from "./revoke-button";

function formatVnDateTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default async function ShareLinksPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}) {
  const { tenantSlug, productId } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/${productId}/share-links`);

  let product;
  let files;
  try {
    ({ product, files } = await getProduct(tenant.id, productId));
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }

  const shareLinks = await listShareLinks(tenant.id, productId);
  const env = getEnv();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Link chia sẻ — {product.title}</h1>

      <div className="mt-6">
        <ShareLinkForm
          tenantSlug={tenantSlug}
          productId={productId}
          files={files.filter((f) => !f.isPreview).map((f) => ({ id: f.id, fileName: f.fileName }))}
          appUrl={env.APP_URL}
        />
      </div>

      <ul className="mt-6 divide-y rounded border">
        {shareLinks.length === 0 ? <li className="p-4 text-sm text-gray-500">Chưa có link chia sẻ nào.</li> : null}
        {shareLinks.map((link) => (
          <li key={link.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{link.label}</p>
              <p className="text-gray-500">
                Đã dùng {link.usedCount}
                {link.maxUses != null ? `/${link.maxUses}` : ""} lượt · Hết hạn {formatVnDateTime(link.expiresAt)}
                {link.passwordHash ? " · Có mật khẩu" : ""}
              </p>
            </div>
            {link.revokedAt ? (
              <span className="text-xs text-gray-400">Đã thu hồi</span>
            ) : (
              <RevokeButton tenantSlug={tenantSlug} productId={productId} shareLinkId={link.id} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
