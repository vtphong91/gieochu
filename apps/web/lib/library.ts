import { withCustomer } from "@gieochu/db";

export interface LibraryFile {
  id: string;
  fileName: string;
  sizeBytes: number;
}

export interface LibraryEntitlement {
  entitlementId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  downloadsUsed: number;
  downloadLimit: number;
  revoked: boolean;
  files: LibraryFile[];
}

export interface LibraryTenantGroup {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  entitlements: LibraryEntitlement[];
}

/** §"M9": "Thư viện gom mọi entitlement của user từ tất cả tenant, nhóm theo tenant". */
export async function listLibraryEntitlements(userId: string): Promise<LibraryTenantGroup[]> {
  const entitlements = await withCustomer(userId, (tx) =>
    tx.entitlement.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            files: { where: { isPreview: false, scanStatus: "CLEAN", removedAt: null }, select: { id: true, fileName: true, sizeBytes: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const groups = new Map<string, LibraryTenantGroup>();
  for (const entitlement of entitlements) {
    let group = groups.get(entitlement.tenantId);
    if (!group) {
      group = { tenantId: entitlement.tenantId, tenantName: entitlement.tenant.name, tenantSlug: entitlement.tenant.slug, entitlements: [] };
      groups.set(entitlement.tenantId, group);
    }
    group.entitlements.push({
      entitlementId: entitlement.id,
      productId: entitlement.productId,
      productTitle: entitlement.product.title,
      productSlug: entitlement.product.slug,
      downloadsUsed: entitlement.downloadsUsed,
      downloadLimit: entitlement.downloadLimit,
      revoked: entitlement.revokedAt != null,
      files: entitlement.product.files,
    });
  }
  return [...groups.values()];
}

export interface LibraryOrder {
  id: string;
  code: string;
  tenantName: string;
  tenantSlug: string;
  productTitle: string;
  totalVnd: number;
  status: string;
  createdAt: Date;
}

/** §"M9": "Lịch sử đơn hàng: mã đơn, tenant, sản phẩm, số tiền, trạng thái, thời gian". */
export async function listCustomerOrders(userId: string): Promise<LibraryOrder[]> {
  const orders = await withCustomer(userId, (tx) =>
    tx.order.findMany({
      where: { customerId: userId },
      include: { tenant: { select: { name: true, slug: true } }, items: { select: { titleSnapshot: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  return orders.map((order) => ({
    id: order.id,
    code: order.code,
    tenantName: order.tenant.name,
    tenantSlug: order.tenant.slug,
    productTitle: order.items.map((item) => item.titleSnapshot).join(", "),
    totalVnd: order.totalVnd,
    status: order.status,
    createdAt: order.createdAt,
  }));
}
