import { getPrismaClient, type Prisma } from "@gieochu/db";
import type { PaymentProviderId as DbPaymentProviderId, SubscriptionInvoiceStatus as DbInvoiceStatus } from "@gieochu/db";
import { getPlatformPaymentConfigRow } from "./platform-payment";
import { sepayInvoiceReferenceCandidates } from "./subscription-billing";

/**
 * ADR-059 (B2) — System Center xem `platform_payment_transactions` (L1, thu phí gói của nền tảng — không đơn hàng/khách của
 * tenant, §7.9). Bảng không có cột trạng thái: trạng thái suy ra từ cột sẵn có (`matchedInvoiceId` + trạng thái hoá đơn) và,
 * với giao dịch chưa khớp, từ `rawPayload` (mã tham chiếu theo cùng quy tắc webhook dùng). Không migration.
 */

/** Bộ lọc lọc được bằng SQL (cột sẵn có). Phân loại chi tiết của "chưa khớp" chỉ hiển thị theo dòng. */
export const PLATFORM_TXN_FILTERS = ["chua-khop", "khop-chua-ap", "da-ap"] as const;
export type PlatformTxnFilter = (typeof PLATFORM_TXN_FILTERS)[number];

export type PlatformTxnState =
  /** Đã khớp và hoá đơn đã thanh toán (hoặc đã hoàn tiền sau đó). */
  | "APPLIED"
  /** Khớp số tiền + mã nhưng hoá đơn chưa thanh toán (vd hoá đơn đã hết hạn khi tiền về, hoặc lỗi giữa chừng). */
  | "MATCHED_NOT_APPLIED"
  /** Có mã hoá đơn hợp lệ nhưng số tiền khác số tiền hoá đơn. */
  | "AMOUNT_MISMATCH"
  /** Có mã đúng tiền tố nhưng không có hoá đơn nào mang mã đó. */
  | "INVOICE_NOT_FOUND"
  /** Nội dung chuyển khoản không chứa mã hoá đơn. */
  | "NO_REFERENCE"
  /** Giao dịch tiền ra / không thành công — không dùng để thanh toán. */
  | "NOT_INCOMING";

export interface PlatformTxnInvoiceRef {
  id: string;
  code: string;
  status: DbInvoiceStatus;
  amountVnd: number;
  provider: DbPaymentProviderId;
  tenant: { name: string; slug: string };
}

export interface PlatformTxnRow {
  id: string;
  provider: DbPaymentProviderId;
  amountVnd: number;
  createdAt: Date;
  /** Mã giao dịch phía cổng (SePay `id`, MoMo `transId`), nếu có. */
  providerTxnId: string | null;
  /** Thời điểm giao dịch theo cổng (chuỗi gốc, SePay giờ VN). */
  transactionDate: string | null;
  /** Nội dung chuyển khoản (cắt ngắn). */
  content: string | null;
  /** Mã hoá đơn đọc được từ giao dịch (cùng quy tắc webhook). */
  reference: string | null;
  state: PlatformTxnState;
  /** Hoá đơn đã khớp, hoặc — với AMOUNT_MISMATCH — hoá đơn mang mã tham chiếu. */
  invoice: PlatformTxnInvoiceRef | null;
  /** Có ≥ 2 giao dịch khớp cùng hoá đơn này (khách trả trùng) — cần xử lý tay. */
  duplicateOfInvoice: boolean;
  /** Số nhận − số tiền hoá đơn (âm = thiếu) khi biết hoá đơn; `null` nếu chưa biết hoá đơn. */
  differenceVnd: number | null;
  /**
   * ADR-059 bổ sung lần 2: hiện nút "Xác nhận hoá đơn từ giao dịch" — giao dịch tiền vào SePay, chưa áp, không thiếu tiền so với hoá
   * đơn đã biết, hoá đơn (nếu biết) đang chờ hoặc đã hết hạn. Server vẫn kiểm lại đầy đủ dưới khoá.
   */
  confirmable: boolean;
}

export interface ListPlatformTransactionsInput {
  filter?: PlatformTxnFilter;
  page: number;
  pageSize: number;
}

const CONTENT_MAX = 160;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function truncate(value: string | null): string | null {
  if (!value) return null;
  return value.length > CONTENT_MAX ? `${value.slice(0, CONTENT_MAX)}…` : value;
}

interface RawFacts {
  providerTxnId: string | null;
  transactionDate: string | null;
  content: string | null;
  /** Mọi mã đọc được theo thứ tự ưu tiên (cùng quy tắc webhook). */
  candidates: string[];
  incoming: boolean;
}

/** Đọc lại payload đã lưu theo đúng quy tắc của webhook platform (SePay: `code` rồi `content` theo `paymentPrefix`). */
function readRawFacts(provider: DbPaymentProviderId, rawPayload: Prisma.JsonValue, sepayPrefix: unknown): RawFacts {
  const raw = asRecord(rawPayload);
  if (provider === "SEPAY") {
    return {
      providerTxnId: optionalString(raw.id),
      transactionDate: optionalString(raw.transactionDate),
      content: truncate(optionalString(raw.content)),
      candidates: sepayInvoiceReferenceCandidates(raw, sepayPrefix),
      incoming: raw.transferType === "in",
    };
  }
  // MoMo IPN: orderId = mã hoá đơn, resultCode 0 = thành công.
  return {
    providerTxnId: optionalString(raw.transId),
    transactionDate: optionalString(raw.responseTime),
    content: truncate(optionalString(raw.orderInfo)),
    candidates: optionalString(raw.orderId) ? [optionalString(raw.orderId)!.toUpperCase()] : [],
    incoming: raw.resultCode === 0 || raw.resultCode === "0",
  };
}

function whereForFilter(filter: PlatformTxnFilter | undefined): Prisma.PlatformPaymentTransactionWhereInput {
  switch (filter) {
    case "chua-khop":
      return { matchedInvoiceId: null };
    case "khop-chua-ap":
      return { matchedInvoice: { status: { notIn: ["PAID", "REFUNDED"] } } };
    case "da-ap":
      return { matchedInvoice: { status: { in: ["PAID", "REFUNDED"] } } };
    default:
      return {};
  }
}

const INVOICE_REF_SELECT = {
  id: true,
  code: true,
  status: true,
  amountVnd: true,
  provider: true,
  tenant: { select: { name: true, slug: true } },
} as const;

/** Người gọi đã `requireAdminAccess()` / `requireRole("SYSTEM_ADMIN")`. Mới nhất trước, phân trang. */
export async function listPlatformTransactions(input: ListPlatformTransactionsInput) {
  const prisma = getPrismaClient();
  const page = Math.max(1, Math.trunc(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize) || 20));
  const where = whereForFilter(input.filter);

  const [rows, total, sepayConfig] = await Promise.all([
    prisma.platformPaymentTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        provider: true,
        amountVnd: true,
        rawPayload: true,
        createdAt: true,
        matchedInvoiceId: true,
        matchedInvoice: { select: INVOICE_REF_SELECT },
      },
    }),
    prisma.platformPaymentTransaction.count({ where }),
    getPlatformPaymentConfigRow("SEPAY"),
  ]);
  const sepayPrefix = asRecord(sepayConfig?.publicConfig).paymentPrefix;

  const facts = rows.map((row) => readRawFacts(row.provider, row.rawPayload, sepayPrefix));
  const unmatchedRefs = [...new Set(rows.flatMap((row, index) => (row.matchedInvoiceId === null ? facts[index]!.candidates : [])))];
  const matchedIds = [...new Set(rows.flatMap((row) => (row.matchedInvoiceId ? [row.matchedInvoiceId] : [])))];

  const [referencedInvoices, matchCounts] = await Promise.all([
    unmatchedRefs.length > 0
      ? prisma.subscriptionInvoice.findMany({ where: { code: { in: unmatchedRefs } }, select: INVOICE_REF_SELECT })
      : Promise.resolve([]),
    matchedIds.length > 0
      ? prisma.platformPaymentTransaction.groupBy({ by: ["matchedInvoiceId"], where: { matchedInvoiceId: { in: matchedIds } }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const invoiceByCode = new Map(referencedInvoices.map((invoice) => [invoice.code, invoice]));
  const matchCountById = new Map(matchCounts.map((entry) => [entry.matchedInvoiceId, entry._count._all]));

  const items: PlatformTxnRow[] = rows.map((row, index) => {
    const fact = facts[index]!;
    const referencedCode = fact.candidates.find((code) => invoiceByCode.has(code));
    const reference = row.matchedInvoice?.code ?? referencedCode ?? fact.candidates[0] ?? null;
    let state: PlatformTxnState;
    let invoice: PlatformTxnInvoiceRef | null = row.matchedInvoice;
    if (row.matchedInvoice) {
      state = row.matchedInvoice.status === "PAID" || row.matchedInvoice.status === "REFUNDED" ? "APPLIED" : "MATCHED_NOT_APPLIED";
    } else if (!fact.incoming) {
      state = "NOT_INCOMING";
    } else if (!reference) {
      state = "NO_REFERENCE";
    } else {
      invoice = referencedCode ? (invoiceByCode.get(referencedCode) ?? null) : null;
      // Webhook khớp khi đúng tiền — giao dịch chưa khớp mà có hoá đơn mang mã ⇒ lệch tiền (thiếu hoặc thừa).
      state = invoice ? "AMOUNT_MISMATCH" : "INVOICE_NOT_FOUND";
    }
    const differenceVnd = invoice ? row.amountVnd - invoice.amountVnd : null;
    const confirmable =
      row.provider === "SEPAY" &&
      fact.incoming &&
      state !== "APPLIED" &&
      (differenceVnd === null || differenceVnd >= 0) &&
      (invoice === null || invoice.status === "PENDING" || invoice.status === "EXPIRED");
    return {
      id: row.id,
      provider: row.provider,
      amountVnd: row.amountVnd,
      createdAt: row.createdAt,
      providerTxnId: fact.providerTxnId,
      transactionDate: fact.transactionDate,
      content: fact.content,
      reference,
      state,
      invoice,
      duplicateOfInvoice: row.matchedInvoiceId !== null && (matchCountById.get(row.matchedInvoiceId) ?? 0) > 1,
      differenceVnd,
      confirmable,
    };
  });
  return { items, total, page, pageSize };
}
