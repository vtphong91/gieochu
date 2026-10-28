/**
 * ADR-063 — Trích xuất + cache bản xem trước 20% nội dung thật của file tài liệu bán.
 *
 * Chỉ server đọc; không có presign URL/byte gốc nào ra client. Payload tối đa ~256 KB sau serialize —
 * nếu vượt, cắt tiếp. `generateAndStorePreview` được gọi:
 *   - Lazy fallback khi route chi tiết yêu cầu và chưa có cache.
 *   - Hook sau khi `file.scan` chuyển `scanStatus = CLEAN` (fire-and-forget, không chặn job).
 */
import { Buffer } from "node:buffer";
import { logger } from "@gieochu/core";
import {
  sliceDocxHtmlParagraphs,
  sliceXlsxRows,
  sliceTextByChars,
} from "@gieochu/core/content/preview-extract";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { getPrismaClient, withPublic, withSystemJob, withTenant } from "@gieochu/db";
import { createS3Client, readObjectAsBuffer } from "@gieochu/storage";
import { getDecryptedSystemStorageConfig, createClientForProvider, type S3ClientInstance, type StorageProvider } from "./system-storage";

export type PreviewKind = "docx" | "xlsx" | "pdf" | "text" | "unsupported";

export interface DocxPayload {
  html: string;
  paragraphsShown: number;
  totalParagraphs: number;
}

export interface XlsxPayload {
  sheetName: string;
  rows: unknown[][];
  rowsShown: number;
  totalRows: number;
}

export interface PdfPayload {
  text: string;
  charsShown: number;
  totalChars: number;
  pageCount: number;
}

export interface TextPayload {
  text: string;
  charsShown: number;
  totalChars: number;
}

export type PreviewPayload = DocxPayload | XlsxPayload | PdfPayload | TextPayload | Record<string, never>;

/** Giới hạn mềm payload JSON cho mỗi bản xem trước (~256 KB sau JSON.stringify). */
const MAX_PAYLOAD_BYTES = 256 * 1024;

/** Phân loại file theo đuôi/mime để chọn nhánh trích xuất. */
export function detectPreviewKind(fileName: string, mimeType: string | null): PreviewKind {
  const lower = fileName.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "md" || ext === "json") return "text";
  if (mimeType?.startsWith("text/")) return "text";
  return "unsupported";
}

export interface ExtractResult {
  kind: PreviewKind;
  payload: PreviewPayload;
  totalEstimate: Record<string, number>;
}

export async function extractPreviewPayload(
  buffer: Buffer,
  fileName: string,
  mimeType: string | null,
): Promise<ExtractResult> {
  const kind = detectPreviewKind(fileName, mimeType);
  try {
    if (kind === "docx") return await extractDocx(buffer);
    if (kind === "xlsx") return await extractXlsx(buffer);
    if (kind === "pdf") return await extractPdf(buffer);
    if (kind === "text") return extractText(buffer);
  } catch (err) {
    logger.warn({ err, fileName, kind }, "ADR-063: trích xuất preview thất bại — rơi về 'unsupported'");
    return { kind: "unsupported", payload: {}, totalEstimate: {} };
  }
  return { kind: "unsupported", payload: {}, totalEstimate: {} };
}

async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const sliced = sliceDocxHtmlParagraphs(html);
  // Sanitize + bỏ ảnh nhúng (imageCloudName null → mọi <img> bị loại).
  const safeHtml = sanitizeRichTextHtml(sliced.html, { imageCloudName: null, imageWidth: 0 });
  const payload: DocxPayload = { html: cutHtmlToBudget(safeHtml), paragraphsShown: sliced.paragraphsShown, totalParagraphs: sliced.totalParagraphs };
  return { kind: "docx", payload, totalEstimate: { totalParagraphs: sliced.totalParagraphs } };
}

async function extractXlsx(buffer: Buffer): Promise<ExtractResult> {
  const xlsx = await import("xlsx");
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0] ?? "Sheet1";
  const sheet = wb.Sheets[sheetName];
  const rows = sheet ? (xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]) : [];
  const sliced = sliceXlsxRows(rows);
  const bounded = truncateRowsToBudget(sliced.rows);
  const payload: XlsxPayload = {
    sheetName,
    rows: bounded,
    rowsShown: bounded.length,
    totalRows: sliced.totalRows,
  };
  return { kind: "xlsx", payload, totalEstimate: { totalRows: sliced.totalRows } };
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  const mod = await import("pdf-parse");
  const pdfParse = (mod as unknown as { default: (b: Buffer, opts?: { max?: number }) => Promise<{ numpages: number; text: string }> }).default;
  // ADR-063: pdf-parse không trả theo trang dễ — chấp nhận giải pháp đơn giản: parse 1 lần lấy toàn text,
  // sau đó cắt 20% ký tự. `numpages` được giữ lại cho metadata.
  const result = await pdfParse(buffer);
  const sliced = sliceTextByChars(result.text ?? "");
  const payload: PdfPayload = {
    text: cutStringToBudget(sliced.text),
    charsShown: sliced.charsShown,
    totalChars: sliced.totalChars,
    pageCount: result.numpages,
  };
  return { kind: "pdf", payload, totalEstimate: { pageCount: result.numpages, totalChars: sliced.totalChars } };
}

function extractText(buffer: Buffer): ExtractResult {
  const text = buffer.toString("utf8");
  const sliced = sliceTextByChars(text);
  const payload: TextPayload = {
    text: cutStringToBudget(sliced.text),
    charsShown: sliced.charsShown,
    totalChars: sliced.totalChars,
  };
  return { kind: "text", payload, totalEstimate: { totalChars: sliced.totalChars } };
}

/** Cắt chuỗi để sau JSON.stringify không vượt MAX_PAYLOAD_BYTES. UTF-8 1 ký tự ≤ 4 byte → ước lượng an toàn. */
function cutStringToBudget(value: string): string {
  const maxChars = Math.floor(MAX_PAYLOAD_BYTES / 4);
  return value.length <= maxChars ? value : value.slice(0, maxChars);
}

function cutHtmlToBudget(html: string): string {
  if (html.length <= MAX_PAYLOAD_BYTES) return html;
  // Cắt thô tại ranh giới `>` gần nhất.
  const cut = html.slice(0, MAX_PAYLOAD_BYTES);
  const lastClose = cut.lastIndexOf(">");
  return lastClose > 0 ? cut.slice(0, lastClose + 1) : cut;
}

function truncateRowsToBudget(rows: unknown[][]): unknown[][] {
  let bytes = 2; // "[]"
  const out: unknown[][] = [];
  for (const row of rows) {
    const chunk = JSON.stringify(row);
    if (bytes + chunk.length + 1 > MAX_PAYLOAD_BYTES) break;
    out.push(row);
    bytes += chunk.length + 1;
  }
  return out;
}

/** Tải object từ storage, chạy trích xuất, upsert vào cache. Không throw ra ngoài cho hook — caller tự catch. */
export async function generateAndStorePreview(productFileId: string): Promise<void> {
  const prisma = getPrismaClient();
  // ADR-010/M5 RLS: product_files thuộc L2 — đọc qua `withSystemJob` (job + lazy fallback đều là ngữ cảnh
  // hệ thống; route handler đã guard tenant/product/file match trước khi gọi vào đây).
  const file = await withSystemJob((tx) => tx.productFile.findUnique({ where: { id: productFileId } }));
  if (!file) return;
  if (file.sourceKind !== "FILE" || !file.objectKey) return;
  if (file.scanStatus !== "CLEAN") return;
  if (file.removedAt) return;
  if (file.isPreview) return;

  const storageConfig = await getDecryptedSystemStorageConfig();
  if (!storageConfig) {
    logger.warn({ productFileId }, "ADR-063: chưa cấu hình storage — bỏ qua sinh preview");
    return;
  }

  let client: S3ClientInstance = createS3Client(storageConfig);
  if (file.storageProvider && file.storageProvider !== storageConfig.activeProvider) {
    try {
      const providerClient = await createClientForProvider(file.storageProvider as StorageProvider);
      client = providerClient.client;
    } catch {
      // fallback: dùng active provider
    }
  }
  const bucket = file.storageBucket || storageConfig.bucketPrivate;

  const buffer = await readObjectAsBuffer(client, bucket, file.objectKey);
  const { kind, payload } = await extractPreviewPayload(buffer, file.fileName, file.mimeType);

  await prisma.productFilePreview.upsert({
    where: { productFileId: file.id },
    create: {
      productFileId: file.id,
      tenantId: file.tenantId,
      productId: file.productId,
      kind,
      payload: payload as object,
      ratio: 20,
      schemaVersion: 1,
    },
    update: {
      kind,
      payload: payload as object,
      ratio: 20,
      schemaVersion: 1,
      generatedAt: new Date(),
    },
  });
}

export interface PublicProductPreviewFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  kind: PreviewKind | "pending";
  pageCount: number | null;
  totalRows: number | null;
  totalCharsEstimate: number | null;
  previewUrl: string;
}

/**
 * Danh sách file bán (CLEAN, không removed, không isPreview) + metadata cache nếu có.
 * `previewUrl` là đường API tương đối. Gọi sau khi guard tenant/product.
 */
export async function listPublicPreviewFiles(
  tenantId: string,
  productId: string,
  tenantSlug: string,
  productSlug: string,
): Promise<PublicProductPreviewFile[]> {
  // product_files là L2 → `withTenant` để RLS cổng; join preview cache cùng lúc (bảng không bật RLS).
  const rows = await withTenant(tenantId, (tx) =>
    tx.productFile.findMany({
      where: {
        productId,
        tenantId,
        sourceKind: "FILE",
        scanStatus: "CLEAN",
        removedAt: null,
        isPreview: false,
      },
      orderBy: { createdAt: "asc" },
      include: { productFilePreview: true },
    }),
  );

  return rows.map((row) => {
    const cache = row.productFilePreview;
    const payload = (cache?.payload ?? null) as Record<string, unknown> | null;
    const kind: PreviewKind | "pending" = (cache?.kind as PreviewKind | undefined) ?? "pending";
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      kind,
      pageCount: typeof payload?.pageCount === "number" ? (payload.pageCount as number) : null,
      totalRows: typeof payload?.totalRows === "number" ? (payload.totalRows as number) : null,
      totalCharsEstimate: typeof payload?.totalChars === "number" ? (payload.totalChars as number) : null,
      previewUrl: `/api/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(productSlug)}/preview/${encodeURIComponent(row.id)}`,
    };
  });
}

export interface PublicPreviewResponse {
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  kind: PreviewKind;
  payload: PreviewPayload;
  ratio: number;
  totalEstimate: Record<string, number>;
}

/**
 * Guard theo ADR-063 §5 + lazy fallback. Trả null nếu không hợp lệ (route 404 tổng).
 * Rate limit là trách nhiệm route handler.
 */
export async function getPreviewForPublicRoute(
  tenantSlug: string,
  productSlug: string,
  fileId: string,
): Promise<PublicPreviewResponse | null> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant || tenant.status !== "ACTIVE") return null;

  const product = await withPublic((tx) =>
    tx.product.findFirst({ where: { tenantId: tenant.id, slug: productSlug, status: "PUBLISHED" } }),
  );
  if (!product) return null;

  const file = await withTenant(tenant.id, (tx) =>
    tx.productFile.findUnique({ where: { id: fileId }, include: { productFilePreview: true } }),
  );
  if (!file) return null;
  if (file.tenantId !== tenant.id || file.productId !== product.id) return null;
  if (file.sourceKind !== "FILE" || file.scanStatus !== "CLEAN" || file.removedAt || file.isPreview) return null;

  // Lazy fallback: chưa có cache → sinh ngay rồi đọc lại.
  let cache = file.productFilePreview;
  if (!cache) {
    try {
      await generateAndStorePreview(file.id);
    } catch (err) {
      logger.warn({ err, productFileId: file.id }, "ADR-063: sinh preview thất bại");
    }
    cache = await prisma.productFilePreview.findUnique({ where: { productFileId: file.id } });
  }

  if (!cache) {
    return {
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      kind: "unsupported",
      payload: {},
      ratio: 20,
      totalEstimate: {},
    };
  }

  const payload = (cache.payload ?? {}) as PreviewPayload;
  const totalEstimate: Record<string, number> = {};
  const pl = payload as Record<string, unknown>;
  for (const key of ["pageCount", "totalRows", "totalParagraphs", "totalChars"]) {
    if (typeof pl[key] === "number") totalEstimate[key] = pl[key] as number;
  }
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    kind: cache.kind as PreviewKind,
    payload,
    ratio: cache.ratio,
    totalEstimate,
  };
}
