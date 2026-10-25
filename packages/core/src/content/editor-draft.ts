import { z } from "zod";
import { LEGAL_DOCUMENT_KEYS } from "../legal/legal-document";

/**
 * ADR-053 bổ sung lần 3 — logic thuần của nháp tự động editor (docs/ke-hoach-tu-luu-nhap-2026-10-24.md mục 3): loại
 * thực thể, khoá thực thể, giới hạn payload và zod "chế độ nháp". Không phụ thuộc Node/DB — client import được qua
 * `@gieochu/core/editor-draft`.
 *
 * "Chế độ nháp" = chỉ kiểm HÌNH DẠNG (field nào, kiểu gì, không vượt kích thước), KHÔNG kiểm nghiệp vụ (tiêu đề bắt buộc,
 * giá hợp lệ…): nháp chỉ đổ lại vào form, còn Lưu/Xuất bản vẫn đi qua validate đầy đủ của từng editor. HTML được
 * `sanitizeRichTextHtml` ở server (apps/web/lib/editor-draft.ts) theo `EDITOR_DRAFT_HTML_FIELDS`.
 */

export const TENANT_EDITOR_DRAFT_ENTITIES = ["POST", "PRODUCT", "STOREFRONT"] as const;
export const SYSTEM_EDITOR_DRAFT_ENTITIES = ["HOME", "SHOP", "PRICING", "MENU", "LEGAL_VERSION"] as const;
export type TenantEditorDraftEntityType = (typeof TENANT_EDITOR_DRAFT_ENTITIES)[number];
export type SystemEditorDraftEntityType = (typeof SYSTEM_EDITOR_DRAFT_ENTITIES)[number];
export type EditorDraftEntityType = TenantEditorDraftEntityType | SystemEditorDraftEntityType;

export const EDITOR_DRAFT_ERROR_CODES = {
  TOO_LARGE: "DRAFT_TOO_LARGE",
  INVALID: "DRAFT_INVALID",
  CONFLICT: "DRAFT_CONFLICT",
  UNAVAILABLE: "DRAFT_UNAVAILABLE",
} as const;

const KB = 1024;
/** Giới hạn payload theo loại (byte UTF-8 của `JSON.stringify`). */
export const EDITOR_DRAFT_MAX_BYTES: Record<EditorDraftEntityType, number> = {
  POST: 400 * KB,
  PRODUCT: 64 * KB,
  STOREFRONT: 256 * KB,
  HOME: 256 * KB,
  SHOP: 256 * KB,
  PRICING: 256 * KB,
  MENU: 256 * KB,
  LEGAL_VERSION: 400 * KB,
};
/** Trần chung — không loại nào vượt (CHECK DB rộng hơn: 1 MiB trên `payload::text`). */
export const EDITOR_DRAFT_HARD_CAP_BYTES = 512 * KB;

/** 20 lần lưu / phút / (người dùng, thực thể). */
export const EDITOR_DRAFT_RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const;
/** Nháp không động tới quá 30 ngày bị cron xoá. */
export const EDITOR_DRAFT_RETENTION_DAYS = 30;

/** Chu kỳ autosave phía client. */
export const EDITOR_DRAFT_DEBOUNCE_MS = 3_000;
export const EDITOR_DRAFT_MAX_INTERVAL_MS = 30_000;

/** Khoá thực thể chưa có id (trang Tạo bài viết / tài liệu). */
export const EDITOR_DRAFT_NEW_KEY = "new";
/** Khoá của editor chỉ có một bản cho mỗi phạm vi (trang gian hàng, trang CMS). */
export const EDITOR_DRAFT_SINGLETON_KEY = "main";
/** Phiên bản pháp lý chưa tạo: `new-<documentKey>` (vd `new-terms`). */
export const LEGAL_DRAFT_NEW_PREFIX = "new-";

const ENTITY_ID = /^[a-z0-9]{1,40}$/i;
/** Tab đã ghi nháp — chuỗi ngẫu nhiên do client sinh (không phải id bản ghi). */
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function isTenantEditorDraftEntity(value: unknown): value is TenantEditorDraftEntityType {
  return typeof value === "string" && (TENANT_EDITOR_DRAFT_ENTITIES as readonly string[]).includes(value);
}

export function isSystemEditorDraftEntity(value: unknown): value is SystemEditorDraftEntityType {
  return typeof value === "string" && (SYSTEM_EDITOR_DRAFT_ENTITIES as readonly string[]).includes(value);
}

export function isValidEditorDraftClientId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_ID.test(value);
}

/**
 * Hình dạng khoá theo loại (chưa kiểm thực thể có tồn tại — việc của server):
 *  - POST/PRODUCT: id thực thể hoặc `"new"`.
 *  - STOREFRONT/HOME/SHOP/PRICING/MENU: chỉ `"main"`.
 *  - LEGAL_VERSION: id phiên bản hoặc `new-<documentKey>` với documentKey có thật.
 */
export function isValidEditorDraftKey(entityType: EditorDraftEntityType, key: unknown): key is string {
  if (typeof key !== "string") return false;
  switch (entityType) {
    case "POST":
    case "PRODUCT":
      return key === EDITOR_DRAFT_NEW_KEY || ENTITY_ID.test(key);
    case "LEGAL_VERSION":
      if (key.startsWith(LEGAL_DRAFT_NEW_PREFIX)) {
        return (LEGAL_DOCUMENT_KEYS as readonly string[]).includes(key.slice(LEGAL_DRAFT_NEW_PREFIX.length));
      }
      return ENTITY_ID.test(key);
    default:
      return key === EDITOR_DRAFT_SINGLETON_KEY;
  }
}

/** Field form thô (chuỗi người dùng đang gõ, ô tick, ô để trống). */
const formField = z.union([z.string(), z.boolean(), z.null()]).optional();

function formDraftSchema(fields: readonly string[]) {
  return z.strictObject(Object.fromEntries(fields.map((name) => [name, formField])));
}

/** Field HTML (Tiptap) theo loại — server sanitize trước khi lưu nháp. */
export const EDITOR_DRAFT_HTML_FIELDS: Record<EditorDraftEntityType, readonly string[]> = {
  POST: ["body"],
  PRODUCT: ["description"],
  LEGAL_VERSION: ["contentHtml"],
  STOREFRONT: [],
  HOME: [],
  SHOP: [],
  PRICING: [],
  MENU: [],
};

/** Độ sâu JSON tối đa cho payload dạng khối (gian hàng, CMS). */
const MAX_JSON_DEPTH = 12;

function jsonDepth(value: unknown, depth = 0): number {
  if (depth > MAX_JSON_DEPTH) return depth;
  if (Array.isArray(value)) return value.reduce<number>((max, item) => Math.max(max, jsonDepth(item, depth + 1)), depth + 1);
  if (value !== null && typeof value === "object") {
    return Object.values(value).reduce<number>((max, item) => Math.max(max, jsonDepth(item, depth + 1)), depth + 1);
  }
  return depth;
}

/** Payload dạng khối (danh sách section/block đang soạn) — chỉ kiểm là JSON hợp lệ, có giới hạn độ sâu. */
const blocksDraftSchema = z
  .strictObject({ blocks: z.json() })
  .refine((value) => jsonDepth(value) <= MAX_JSON_DEPTH, { message: "Bản nháp lồng quá sâu." });

const DRAFT_SCHEMAS: Record<EditorDraftEntityType, z.ZodType<Record<string, unknown>>> = {
  POST: formDraftSchema(["title", "body", "productId"]),
  PRODUCT: formDraftSchema([
    "title",
    "type",
    "summary",
    "description",
    "coverImageUrl",
    "visibility",
    "categoryId",
    "tags",
    "priceVnd",
    "salePriceVnd",
    "saleStartsAt",
    "saleEndsAt",
    "downloadLimit",
  ]),
  STOREFRONT: blocksDraftSchema,
  HOME: blocksDraftSchema,
  SHOP: blocksDraftSchema,
  PRICING: blocksDraftSchema,
  MENU: blocksDraftSchema,
  LEGAL_VERSION: formDraftSchema(["contentHtml", "changeSummary"]),
};

/** Số byte UTF-8 của `JSON.stringify(value)`; null khi không tuần tự hoá được (vòng tham chiếu, BigInt…). */
export function editorDraftPayloadBytes(value: unknown): number | null {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : new TextEncoder().encode(text).length;
  } catch {
    return null;
  }
}

export type EditorDraftPayload = Record<string, unknown>;

export type ParseEditorDraftResult =
  | { ok: true; payload: EditorDraftPayload; bytes: number }
  | { ok: false; code: (typeof EDITOR_DRAFT_ERROR_CODES)["TOO_LARGE" | "INVALID"]; message: string };

/**
 * Kiểm kích thước (theo loại, rồi trần chung) TRƯỚC khi parse zod — payload khổng lồ không đi qua zod. Thông báo lỗi
 * không lặp lại nội dung nháp.
 */
export function parseEditorDraftPayload(entityType: EditorDraftEntityType, raw: unknown): ParseEditorDraftResult {
  const bytes = editorDraftPayloadBytes(raw);
  if (bytes === null) return { ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID, message: "Bản nháp không hợp lệ." };
  if (bytes > Math.min(EDITOR_DRAFT_MAX_BYTES[entityType], EDITOR_DRAFT_HARD_CAP_BYTES)) {
    return { ok: false, code: EDITOR_DRAFT_ERROR_CODES.TOO_LARGE, message: "Bản nháp quá lớn để tự lưu. Hãy bấm Lưu để giữ thay đổi." };
  }
  const parsed = DRAFT_SCHEMAS[entityType].safeParse(raw);
  if (!parsed.success) return { ok: false, code: EDITOR_DRAFT_ERROR_CODES.INVALID, message: "Bản nháp không hợp lệ." };
  return { ok: true, payload: parsed.data, bytes };
}
