/**
 * ADR-074 mục 5 — độ dài tối đa của "lý do" khi System Admin khoá người dùng (ADR-073) / khoá gian hàng (ADR-072).
 * Module CLIENT-SAFE: không import Prisma/server, để hộp thoại client và server cùng dùng MỘT hằng (không hard-code 500 hai nơi).
 */
export const LOCK_REASON_MAX_LENGTH = 500;
