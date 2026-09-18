import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "../../../../../../lib/tenant";
import { presignCoverImageUpload } from "../../../../../../lib/product-upload";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../../../lib/api-response";

const schema = z.object({
  productId: z.string().min(1),
  fileName: z.string().min(1),
  sizeBytes: z.coerce.number().int().positive(),
  mimeType: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { tenantSlug } = await params;
    const { tenant } = await requireTenantMember(tenantSlug);
    const input = await parseJsonBody(request, schema);
    const result = await presignCoverImageUpload(tenant.id, input.productId, input);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
