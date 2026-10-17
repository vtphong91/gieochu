import { forbidden } from "@gieochu/core";
import type { Tenant } from "@gieochu/db";

/**
 * §"M3" + ADR-040: a READ_ONLY (or LOCKED) tenant cannot create new products/posts/orders. Its public storefront no
 * longer shows products (READ_ONLY guests see a "tạm ngưng" notice, LOCKED guests get 404); customers who already
 * bought keep downloading from their library. Called before tenant-side writes.
 */
export function assertTenantCanWrite(tenant: Pick<Tenant, "status">): void {
  if (tenant.status !== "ACTIVE") {
    throw forbidden("Trang đang tạm ngưng bán, không thể thực hiện thao tác này.");
  }
}
