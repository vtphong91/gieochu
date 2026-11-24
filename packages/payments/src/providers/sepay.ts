import { timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import QRCode from "qrcode";
import { buildVietQrPayload } from "../vietqr";
import type { CreateCheckoutArgs, NormalizedPaymentEvent, PaymentProvider, RawWebhookRequest, SepayConfig, TestResult } from "../types";

const sepayConfigSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4).max(30),
  accountName: z.string().min(1),
  authType: z.enum(["API_KEY", "HMAC_SHA256"]),
  secret: z.string().min(1),
  paymentPrefix: z.string().min(1),
  /** API Token (my.sepay.vn → Cấu hình Công ty → API Access) — chỉ dùng cho "Kiểm tra kết nối", không bắt buộc. */
  apiToken: z.string().optional(),
});

/** SePay User API v1 — giới hạn 2 request/giây/IP (vượt → 429). */
export const SEPAY_BANK_ACCOUNTS_URL = "https://my.sepay.vn/userapi/bankaccounts/list";
const SEPAY_TEST_TIMEOUT_MS = 10_000;

interface SepayBankAccount {
  account_number?: string;
  bank_bin?: string;
  bank_short_name?: string;
  active?: string | number;
}

function tail4(accountNo: string): string {
  return accountNo.length > 4 ? `••••${accountNo.slice(-4)}` : "••••";
}

/**
 * Kiểm tra kết nối SePay: gọi User API (`Authorization: Bearer <apiToken>`) lấy danh sách tài khoản ngân hàng, xác nhận
 * token hợp lệ và số tài khoản đã cấu hình có trên SePay, đang hoạt động, đúng ngân hàng. KHÔNG kiểm tra được secret
 * webhook (SePay không có API cho việc này). Không trả số tài khoản đầy đủ/token trong thông báo.
 */
export async function testSepayConnection(cfg: SepayConfig, fetchImpl: typeof fetch = fetch): Promise<TestResult> {
  const token = cfg.apiToken?.trim();
  if (!token) {
    return { ok: false, message: "Chưa nhập API Token SePay — lấy ở my.sepay.vn → Cấu hình Công ty → API Access, lưu rồi kiểm tra lại." };
  }

  let response: Response;
  try {
    response = await fetchImpl(SEPAY_BANK_ACCOUNTS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(SEPAY_TEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, message: "Không kết nối được tới SePay (mạng lỗi hoặc quá thời gian chờ). Thử lại sau." };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: "API Token SePay không hợp lệ hoặc đã bị tắt — kiểm tra lại ở my.sepay.vn → API Access." };
  }
  if (response.status === 429) {
    return { ok: false, message: "SePay đang giới hạn tần suất gọi API — đợi vài giây rồi thử lại." };
  }
  if (!response.ok) {
    return { ok: false, message: `SePay trả lỗi HTTP ${response.status}.` };
  }

  let accounts: SepayBankAccount[];
  try {
    const body = (await response.json()) as { bankaccounts?: unknown };
    if (!Array.isArray(body.bankaccounts)) return { ok: false, message: "Phản hồi không hợp lệ từ SePay." };
    accounts = body.bankaccounts as SepayBankAccount[];
  } catch {
    return { ok: false, message: "Phản hồi không hợp lệ từ SePay." };
  }

  const wanted = cfg.accountNo.replace(/\s+/g, "");
  const account = accounts.find((item) => String(item.account_number ?? "").replace(/\s+/g, "") === wanted);
  if (!account) {
    return {
      ok: false,
      message: `API Token hợp lệ nhưng không thấy tài khoản ${tail4(wanted)} trên SePay — kiểm tra số tài khoản hoặc liên kết tài khoản ngân hàng trong SePay.`,
    };
  }
  if (account.bank_bin && account.bank_bin !== cfg.bankBin) {
    return { ok: false, message: `Tài khoản ${tail4(wanted)} trên SePay thuộc ngân hàng khác (${account.bank_short_name ?? account.bank_bin}) — kiểm tra lại ô Ngân hàng.` };
  }
  if (String(account.active ?? "1") !== "1") {
    return { ok: false, message: `Tài khoản ${tail4(wanted)} đang tạm khoá trên SePay.` };
  }
  return { ok: true, message: `Kết nối thành công — tài khoản ${account.bank_short_name ?? ""} ${tail4(wanted)} đang hoạt động trên SePay.`.replace(/\s+/g, " ") };
}

async function createSepayCheckout(args: CreateCheckoutArgs<SepayConfig>) {
  const qrPayload = buildVietQrPayload({
    bankBin: args.cfg.bankBin,
    accountNo: args.cfg.accountNo,
    amountVnd: args.amountVnd,
    content: args.reference,
  });
  const qrImageDataUrl = await QRCode.toDataURL(qrPayload);
  return {
    kind: "QR" as const,
    qrPayload,
    qrImageDataUrl,
    bank: { bin: args.cfg.bankBin, accountNo: args.cfg.accountNo, accountName: args.cfg.accountName },
    content: args.reference,
  };
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * §"M7": header names/format verified against SePay's official webhook docs
 * (Authorization: Apikey <key>; X-SePay-Signature: sha256=<hex>, signing
 * `{timestamp}.{rawBody}` — X-SePay-Timestamp holds the timestamp).
 */
async function verifySepayWebhook(req: RawWebhookRequest, cfg: SepayConfig): Promise<boolean> {
  if (cfg.authType === "API_KEY") {
    const header = req.headers["authorization"] ?? "";
    return safeEqual(header, `Apikey ${cfg.secret}`);
  }

  const signatureHeader = req.headers["x-sepay-signature"] ?? "";
  const timestamp = req.headers["x-sepay-timestamp"] ?? "";
  const expected = `sha256=${createHmac("sha256", cfg.secret).update(`${timestamp}.${req.rawBody}`).digest("hex")}`;
  return safeEqual(signatureHeader, expected);
}

export interface SepayWebhookBody {
  id: number | string;
  code?: string | null;
  content?: string;
  transferType: "in" | "out";
  transferAmount: number;
  transactionDate: string;
}

export interface SepayReferenceOptions {
  /**
   * ADR-059 bổ sung lần 2: số ký tự SAU tiền tố của mã sinh ra (mã hoá đơn 8, mã đơn 6). Có giá trị → chỉ bắt đúng ngần ấy ký
   * tự, nên nội dung bị ngân hàng nối liền ("SUBABCDEFGHNGUYENVANA") vẫn tách đúng mã. Bỏ trống → hành vi cũ (bắt tới hết chuỗi
   * chữ/số).
   */
  codeLength?: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mọi mã tham chiếu đọc được, theo thứ tự ưu tiên: từng tiền tố (theo thứ tự truyền vào) — `code` (SePay tự nhận diện) trước,
 * rồi `content`. Tiền tố được escape (người dùng tự điền). Không trùng lặp, viết hoa.
 */
export function extractSepayReferences(body: SepayWebhookBody, prefixes: readonly string[], options: SepayReferenceOptions = {}): string[] {
  const suffix = options.codeLength && options.codeLength > 0 ? `[A-Z0-9]{${options.codeLength}}` : "[A-Z0-9]*";
  const found: string[] = [];
  for (const prefix of prefixes) {
    const trimmed = prefix.trim();
    if (!trimmed) continue;
    const pattern = new RegExp(`${escapeRegExp(trimmed)}${suffix}`, "i");
    for (const source of [body.code, body.content]) {
      const match = source ? source.match(pattern) : null;
      if (match && !found.includes(match[0].toUpperCase())) found.push(match[0].toUpperCase());
    }
  }
  return found;
}

/** Extracts the reference (order/invoice code) using `code` first, then a prefix search in `content` (§"M7"). */
export function extractSepayReference(body: SepayWebhookBody, paymentPrefix: string, options: SepayReferenceOptions = {}): string | undefined {
  return extractSepayReferences(body, [paymentPrefix], options)[0];
}

// `parseWebhook` matches the shared PaymentProvider interface (body only —
// no cfg), so it cannot know the tenant's paymentPrefix. Callers extract the
// reference separately via extractSepayReference(body, cfg.paymentPrefix).
/**
 * ADR-059 bổ sung lần 2: payload thiếu/sai trường bắt buộc → ném lỗi (route trả 400 + log), không để TypeError thành 500.
 * Số tiền nhận cả số lẫn chuỗi số nguyên không âm.
 */
function parseSepayWebhook(body: unknown): NormalizedPaymentEvent {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("SePay webhook: body không phải object JSON");
  const payload = body as SepayWebhookBody;
  const amount = typeof payload.transferAmount === "string" ? Number(payload.transferAmount) : payload.transferAmount;
  if (
    (typeof payload.id !== "string" && typeof payload.id !== "number") ||
    String(payload.id).trim() === "" ||
    (payload.transferType !== "in" && payload.transferType !== "out") ||
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < 0 ||
    typeof payload.transactionDate !== "string"
  ) {
    throw new Error("SePay webhook: thiếu hoặc sai trường bắt buộc (id, transferType, transferAmount, transactionDate)");
  }
  return {
    providerEventId: String(payload.id),
    amountVnd: amount,
    occurredAt: new Date(`${payload.transactionDate.replace(" ", "T")}+07:00`),
    success: payload.transferType === "in",
    raw: body,
  };
}

export const sepayProvider: PaymentProvider<SepayConfig> = {
  id: "SEPAY",
  validateConfig(input) {
    return sepayConfigSchema.parse(input);
  },
  testConnection: (cfg) => testSepayConnection(cfg),
  createCheckout: createSepayCheckout,
  verifyWebhook: verifySepayWebhook,
  parseWebhook: parseSepayWebhook,
};
