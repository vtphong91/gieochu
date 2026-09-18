export type PurchaseBlockReason = "OWN_PRODUCT" | "ALREADY_OWNED";

export interface PurchaseGuardResult {
  allowed: boolean;
  reason?: PurchaseBlockReason;
}

/** §"M8": "Chặn mua lại sản phẩm đã có entitlement còn hiệu lực... Chặn owner mua sản phẩm của chính mình." */
export function canPurchaseProduct(input: { isOwner: boolean; hasActiveEntitlement: boolean }): PurchaseGuardResult {
  if (input.isOwner) return { allowed: false, reason: "OWN_PRODUCT" };
  if (input.hasActiveEntitlement) return { allowed: false, reason: "ALREADY_OWNED" };
  return { allowed: true };
}
