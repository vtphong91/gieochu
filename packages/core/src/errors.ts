export interface AppErrorOptions {
  /** Stable machine-readable error code, e.g. "COUPON_EXPIRED". */
  code: string;
  message: string;
  httpStatus?: number;
  /** Whether `message` is safe to show to the client. Defaults to true. */
  expose?: boolean;
  cause?: unknown;
}

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

const GENERIC_MESSAGE = "Đã xảy ra lỗi. Vui lòng thử lại sau.";

/**
 * Unified application error. Route handlers and server actions throw this
 * (or a subclass/factory below) and a single mapper turns it into the HTTP
 * error shape from docs/GIEOCHU_PROMPT_MVP_PHASE1.md §6.
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly expose: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.httpStatus = options.httpStatus ?? 400;
    this.expose = options.expose ?? true;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  toResponseBody(requestId: string): ErrorResponseBody {
    return {
      error: {
        code: this.code,
        message: this.expose ? this.message : GENERIC_MESSAGE,
        requestId,
      },
    };
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export function unauthorized(message = "Chưa đăng nhập"): AppError {
  return new AppError({ code: ErrorCodes.UNAUTHORIZED, message, httpStatus: 401 });
}

export function forbidden(message = "Không có quyền truy cập"): AppError {
  return new AppError({ code: ErrorCodes.FORBIDDEN, message, httpStatus: 403 });
}

export function notFound(message = "Không tìm thấy"): AppError {
  return new AppError({ code: ErrorCodes.NOT_FOUND, message, httpStatus: 404 });
}

export function conflict(code: string, message: string): AppError {
  return new AppError({ code, message, httpStatus: 409 });
}

export function rateLimited(message = "Bạn thao tác quá nhanh, vui lòng thử lại sau"): AppError {
  return new AppError({ code: ErrorCodes.RATE_LIMITED, message, httpStatus: 429 });
}

/** Wraps an unexpected internal failure; message is never exposed to the client. */
export function internalError(message = "Internal error", cause?: unknown): AppError {
  return new AppError({
    code: ErrorCodes.INTERNAL_ERROR,
    message,
    httpStatus: 500,
    expose: false,
    cause,
  });
}

/** Maps any thrown value to an HTTP status + response body, per docs §6. */
export function toHttpError(error: unknown, requestId: string): { status: number; body: ErrorResponseBody } {
  const appError = error instanceof AppError ? error : internalError("Unhandled error", error);
  return { status: appError.httpStatus, body: appError.toResponseBody(requestId) };
}
