import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantMember } from "../../../../../../lib/tenant";
import { completeProductFileUpload } from "../../../../../../lib/product-upload";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../../../lib/api-response";

const completeSchema = z.object({
  productId: z.string().min(1),
  objectKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.coerce.number().int().positive(),
  isPreview: z.boolean().default(false),
  uploadId: z.string().optional(),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), eTag: z.string().min(1) })).optional(),
});

/** §"M5": HeadObject inside completeProductFileUpload is what actually confirms the upload — never trust the client's claim alone. */
export async function POST(request: Request, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { tenantSlug } = await params;
    const { tenant } = await requireTenantMember(tenantSlug);
    const input = await parseJsonBody(request, completeSchema);
    const file = await completeProductFileUpload(tenant.id, input.productId, input);
    return NextResponse.json(file);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
