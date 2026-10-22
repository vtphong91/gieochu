import { NextResponse } from "next/server";
import { AppError, logger, notFound, openStorageTicket } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getRequestId, handleApiError } from "../../../../../lib/api-response";
import { STORAGE_GATEWAY_PATH_PREFIX, isStorageGatewayEnabled } from "../../../../../lib/storage-gateway";

export const dynamic = "force-dynamic";

const NO_STORE = "no-store";

type RejectReason = "BAD_URI" | "INVALID_TICKET" | "METHOD_MISMATCH" | "LENGTH_MISSING" | "LENGTH_EXCEEDED";

/**
 * nginx `auth_request` chỉ hiểu 2xx (cho qua) và 401/403 (từ chối) — mã khác thành 500. Vì vậy mọi lý do từ chối
 * (kể cả vượt dung lượng) đều trả 403; lý do chỉ ghi log, không log vé hay target.
 */
function reject(reason: RejectReason, requestId: string): NextResponse {
  logger.warn({ requestId, reason }, "storage gateway: từ chối vé");
  const response = handleApiError(
    new AppError({ code: "STORAGE_TICKET_REJECTED", message: "Không có quyền truy cập tệp.", httpStatus: 403 }),
    requestId,
  );
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/**
 * ADR-045: endpoint nội bộ cho nginx `auth_request` của `location /_s/` (nginx chặn `/api/internal/` từ ngoài).
 * Không requireUser — vé mã hoá (AES-256-GCM, hạn ≤ hạn presign) chính là credential, cùng mô hình tin cậy với
 * presigned URL. Vé hợp lệ → 204 + `X-Storage-Target` (pathname+search presigned nội bộ) để nginx `proxy_pass`.
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    if (!isStorageGatewayEnabled()) {
      throw notFound();
    }

    const originalUri = request.headers.get("x-original-uri") ?? "";
    const path = originalUri.split("?")[0] ?? "";
    if (!path.startsWith(STORAGE_GATEWAY_PATH_PREFIX)) return reject("BAD_URI", requestId);
    const ticket = path.slice(STORAGE_GATEWAY_PATH_PREFIX.length);

    const payload = openStorageTicket(ticket, getEnv().STORAGE_ENCRYPTION_KEY, Math.floor(Date.now() / 1000));
    if (!payload) return reject("INVALID_TICKET", requestId);

    const method = (request.headers.get("x-original-method") ?? "").toUpperCase();
    if (method !== payload.method) return reject("METHOD_MISMATCH", requestId);

    if (payload.method === "PUT" && payload.maxBytes !== undefined) {
      const rawLength = (request.headers.get("x-original-length") ?? "").trim();
      if (!/^\d+$/.test(rawLength)) return reject("LENGTH_MISSING", requestId);
      if (Number(rawLength) > payload.maxBytes) return reject("LENGTH_EXCEEDED", requestId);
    }

    return new NextResponse(null, {
      status: 204,
      headers: { "X-Storage-Target": payload.target, "Cache-Control": NO_STORE },
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
