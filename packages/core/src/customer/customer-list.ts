/**
 * ADR-048 — hằng dùng chung của danh sách Khách hàng Studio. File thuần (không phụ thuộc Prisma/Node) để Client Component
 * import được qua `@gieochu/core/customer-list`; loader `apps/web/lib/customer-list.ts` dùng cùng giá trị.
 */

/** Ghi chú khách (`tenant_customers.note`) tối đa ngần này ký tự (sau NFC + trim). */
export const CUSTOMER_NOTE_MAX_LENGTH = 500;

/** "Lâu chưa quay lại" = không có đơn đã thanh toán nào trong ngần này ngày. */
export const INACTIVE_CUSTOMER_DAYS = 90;
