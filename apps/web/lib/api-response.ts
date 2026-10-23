import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, loggerWithRequestId, toHttpError } from "@gieochu/core";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function handleApiError(error: unknown, requestId: string): NextResponse {
  const { status, body } = toHttpError(error, requestId);
  // Lỗi 5xx bị che message ở response — ghi log kèm requestId để tra được nguyên nhân thật.
  if (status >= 500) {
    loggerWithRequestId(requestId).error({ err: error instanceof AppError ? (error.cause ?? error) : error }, "api: lỗi không xử lý được");
  }
  return NextResponse.json(body, { status });
}

/** Parses and validates a JSON request body; throws a 400 AppError on failure. */
export async function parseJsonBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError({ code: "INVALID_JSON", message: "Nội dung yêu cầu không hợp lệ.", httpStatus: 400 });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: result.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
      httpStatus: 400,
    });
  }
  return result.data;
}
