import { forbidden } from "@gieochu/core";
import type { Tenant } from "@gieochu/db";

/**
 * §"M3": a READ_ONLY (or LOCKED) tenant keeps its storefront and existing
 * downloads working but cannot create new products/posts/orders. M5/M8/M9
 * call this before their respective writes once those modules exist.
 */
export function assertTenantCanWrite(tenant: Pick<Tenant, "status">): void {
  if (tenant.status !== "ACTIVE") {
    throw forbidden("Trang đang tạm ngưng bán, không thể thực hiện thao tác này.");
  }
}
