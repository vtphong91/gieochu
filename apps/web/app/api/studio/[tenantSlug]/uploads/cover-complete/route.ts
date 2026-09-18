import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "../../../../../../lib/tenant";
import { completeCoverImageUpload } from "../../../../../../lib/product-upload";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../../../lib/api-response";

const schema = z.object({
  productId: z.string().min(1),
  objectKey: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { tenantSlug } = await params;
    const { tenant } = await requireTenantMember(tenantSlug);
    const input = await parseJsonBody(request, schema);
    await completeCoverImageUpload(tenant.id, input.productId, input.objectKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
