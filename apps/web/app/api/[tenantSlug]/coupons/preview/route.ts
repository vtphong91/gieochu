import { NextResponse } from "next/server";
import { z } from "zod";
import { notFound } from "@gieochu/core";
import { findTenantBySlugForStorefront } from "../../../../../lib/storefront";
import { previewCouponPrice } from "../../../../../lib/coupon";
import { getCurrentUser } from "../../../../../lib/session";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../../lib/api-response";

const schema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
  couponCode: z.string().trim().optional(),
});

/**
 * §"M6" — public (no auth required, matches the storefront it's a cart
 * preview for): recalculates price + coupon discount server-side. Never
 * trust a client-supplied total — M8's checkout calls the same
 * calculatePrice() engine again before accepting payment.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { tenantSlug } = await params;
    const tenant = await findTenantBySlugForStorefront(tenantSlug);
    if (!tenant) throw notFound("Không tìm thấy trang.");

    const input = await parseJsonBody(request, schema);
    const user = await getCurrentUser();

    const result = await previewCouponPrice(tenant.id, {
      productIds: input.productIds,
      couponCode: input.couponCode,
      userId: user?.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
