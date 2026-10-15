import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { requireTenantMemberPage } from "../../../../../../lib/page-guards";
import { getProduct } from "../../../../../../lib/product";
import { listShareLinks } from "../../../../../../lib/share-link";
import { ShareLinkForm } from "./share-link-form";
import { RevokeButton } from "./revoke-button";
import { AdminPageHeader, Badge, DataTable, EmptyState, SettingsGrid, Td, Tr } from "../../../../../admin/_ui/kit";
import { IconLinkChain } from "../../../../../_ui/editor/toolbar-icons";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

function formatVnDateTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
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
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Link chia sẻ private" subtitle={product.title} />

      <SettingsGrid>
        <ShareLinkForm
          tenantSlug={tenantSlug}
          productId={productId}
          files={files.filter((f) => !f.isPreview).map((f) => ({ id: f.id, fileName: f.fileName }))}
          appUrl={env.APP_URL}
        />
      </SettingsGrid>

      <div className="mt-6">
        {shareLinks.length === 0 ? (
          <EmptyState icon={<IconLinkChain className="h-6 w-6" />} title="Chưa có link chia sẻ nào" />
        ) : (
          <DataTable head={["Nhãn", "Tình trạng", ""]}>
            {shareLinks.map((link) => (
              <Tr key={link.id}>
                <Td className="font-medium">{link.label}</Td>
                <Td className="text-gray-500">
                  Đã dùng {link.usedCount}
                  {link.maxUses != null ? `/${link.maxUses}` : ""} lượt · Hết hạn {formatVnDateTime(link.expiresAt)}
                  {link.passwordHash ? " · Có mật khẩu" : ""}
                </Td>
                <Td>{link.revokedAt ? <Badge tone="neutral">Đã thu hồi</Badge> : <RevokeButton tenantSlug={tenantSlug} productId={productId} shareLinkId={link.id} />}</Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </div>
    </main>
  );
}
