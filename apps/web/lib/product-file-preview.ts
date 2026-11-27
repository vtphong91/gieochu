/**
 * ADR-063 — Trích xuất + cache bản xem trước 20% nội dung thật của file tài liệu bán.
 *
 * Chỉ server đọc; không có presign URL/byte gốc nào ra client. Payload tối đa ~512 KB sau serialize —
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
  slicePptxSlides,
  calculatePdfPagesToSlice,
  type PptxSlide,
} from "@gieochu/core/content/preview-extract";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { withPublic, withSystemJob, withTenant } from "@gieochu/db";
import { createS3Client, readObjectAsBuffer } from "@gieochu/storage";
import { getDecryptedSystemStorageConfig, createClientForProvider, type S3ClientInstance, type StorageProvider } from "./system-storage";

export type PreviewKind = "docx" | "xlsx" | "pdf" | "pptx" | "text" | "unsupported";

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
  pdfBase64?: string;
  pagesShown: number;
  pageCount: number;
  text: string;
  charsShown: number;
  totalChars: number;
}

export interface PptxPayload {
  slides: PptxSlide[];
  slidesShown: number;
  totalSlides: number;
}

export interface TextPayload {
  text: string;
  charsShown: number;
  totalChars: number;
}

export type PreviewPayload = DocxPayload | XlsxPayload | PdfPayload | PptxPayload | TextPayload | Record<string, never>;

/** Giới hạn mềm payload JSON cho mỗi bản xem trước (~512 KB sau JSON.stringify). */
const MAX_PAYLOAD_BYTES = 512 * 1024;

/** Phân loại file theo đuôi/mime để chọn nhánh trích xuất. */
export function detectPreviewKind(fileName: string, mimeType: string | null): PreviewKind {
  const lower = fileName.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (ext === "docx") return "docx";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (mimeType?.includes("presentation") || mimeType?.includes("powerpoint")) return "pptx";
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
    if (kind === "pptx") return await extractPptx(buffer, fileName);
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
  let numpages = 1;
  let rawText = "";

  try {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as { default: (b: Buffer, opts?: { max?: number }) => Promise<{ numpages: number; text: string }> }).default;
    const result = await pdfParse(buffer);
    numpages = result.numpages || 1;
    rawText = result.text || "";
  } catch (err) {
    logger.warn({ err }, "extractPdf: pdf-parse trích xuất văn bản lỗi, tiếp tục với pdf-lib");
  }

  const slicedText = sliceTextByChars(rawText);
  const { pagesShown } = calculatePdfPagesToSlice(numpages);

  // Trích xuất trang PDF thật bằng pdf-lib để giữ nguyên vẹn định dạng, màu sắc, hình ảnh & vector
  let pdfBase64: string | undefined;
  try {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const actualPages = srcDoc.getPageCount();
    const sliceCount = Math.max(1, Math.min(20, Math.ceil(actualPages * 0.2)));

    const newDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: sliceCount }, (_, i) => i);
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }

    // Đóng dấu watermark mờ để bảo vệ bản quyền
    try {
      const font = await newDoc.embedFont(StandardFonts.HelveticaBold);
      for (const page of newDoc.getPages()) {
        const { width, height } = page.getSize();
        page.drawText("GIEO CHU - BAN XEM TRUOC 20%", {
          x: width * 0.1,
          y: height * 0.45,
          size: Math.max(14, Math.min(26, width / 20)),
          font,
          color: rgb(0.85, 0.2, 0.2),
          opacity: 0.15,
          rotate: degrees(35),
        });
      }
    } catch {
      // Bỏ qua lỗi font nếu xảy ra
    }

    const pdfBytes = await newDoc.save();
    const base64Str = Buffer.from(pdfBytes).toString("base64");
    // Giữ nếu không vượt quá giới hạn an toàn (~3 MB base64)
    if (base64Str.length <= 3 * 1024 * 1024) {
      pdfBase64 = base64Str;
    }
  } catch (err) {
    logger.warn({ err }, "extractPdf: pdf-lib trích xuất trang thất bại, rơi về văn bản thô");
  }

  const payload: PdfPayload = {
    pdfBase64,
    pagesShown,
    pageCount: numpages,
    text: cutStringToBudget(slicedText.text),
    charsShown: slicedText.charsShown,
    totalChars: slicedText.totalChars,
  };
  return { kind: "pdf", payload, totalEstimate: { pageCount: numpages, pagesShown, totalChars: slicedText.totalChars } };
}

async function extractPptx(buffer: Buffer, fileName: string): Promise<ExtractResult> {
  const isPptOld = fileName.toLowerCase().endsWith(".ppt");
  if (isPptOld) {
    // Định dạng .ppt nhị phân cũ (97-2003): bóc chuỗi ký tự hiển thị
    const str = buffer.toString("latin1");
    const textRuns = Array.from(str.matchAll(/[\x20-\x7E\xA0-\xFF]{4,}/g), (m) => m[0].trim()).filter((t) => t.length > 3);
    const bullets = textRuns.slice(0, 10);
    const slides: PptxSlide[] = [
      {
        slideNumber: 1,
        title: fileName.replace(/\.ppt$/i, ""),
        bullets: bullets.length > 0 ? bullets : ["Tài liệu PowerPoint 97-2003 (.ppt). Khuyên dùng định dạng .pptx để xem slide trực quan."],
      },
    ];
    const payload: PptxPayload = {
      slides,
      slidesShown: 1,
      totalSlides: 1,
    };
    return { kind: "pptx", payload, totalEstimate: { slideCount: 1 } };
  }

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));

  // Sắp xếp tự nhiên theo số thứ tự slide: slide1, slide2, slide10...
  slideFiles.sort((a, b) => {
    const numA = Number.parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
    const numB = Number.parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
    return numA - numB;
  });

  const rawSlides: PptxSlide[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    if (!slideFile) continue;
    const fileEntry = zip.file(slideFile);
    if (!fileEntry) continue;
    const xml = await fileEntry.async("string");
    if (!xml) continue;

    let title = "";
    // Tìm khung tiêu đề theo placeholder title hoặc ctrTitle
    const titleMatch = xml.match(/<p:sp>[\s\S]*?<p:ph[^>]*type="(?:title|ctrTitle)"[\s\S]*?<\/p:sp>/i);
    if (titleMatch) {
      const tRuns = Array.from(titleMatch[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), (m: RegExpMatchArray) => m[1] || "");
      title = tRuns.join("").trim();
    }

    // Tìm các đoạn văn bản / bullet points của slide
    const bullets: string[] = [];
    const pMatches = Array.from(xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g));
    for (const pm of pMatches) {
      const pText = Array.from((pm[1] || "").matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), (m: RegExpMatchArray) => m[1] || "").join("").trim();
      if (pText && pText !== title && !bullets.includes(pText)) {
        bullets.push(pText);
      }
    }

    if (!title && bullets.length > 0) {
      title = bullets.shift() || `Slide ${i + 1}`;
    }
    if (!title) {
      title = `Slide ${i + 1}`;
    }

    rawSlides.push({
      slideNumber: i + 1,
      title,
      bullets: bullets.slice(0, 15),
    });
  }

  const sliced = slicePptxSlides(rawSlides);
  const payload: PptxPayload = {
    slides: sliced.slides,
    slidesShown: sliced.slidesShown,
    totalSlides: sliced.totalSlides,
  };
  return { kind: "pptx", payload, totalEstimate: { slideCount: sliced.totalSlides } };
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

  // Ghi cache trong scope system_job (hàm chạy từ hook `file.scan` lẫn lazy fallback). Tải storage + trích xuất ở
  // trên nằm NGOÀI transaction để không giữ kết nối DB trong lúc đọc object.
  await withSystemJob((tx) =>
    tx.productFilePreview.upsert({
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
    }),
  );
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
  slideCount: number | null;
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
      slideCount: typeof payload?.slideCount === "number" ? (payload.slideCount as number) : null,
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
  // Bước 1 (withPublic): gian hàng ACTIVE + sản phẩm PUBLISHED. Policy `products` dưới scope public chỉ trả dòng
  // PUBLISHED; `tenants` không bật RLS (ADR-023) nên đọc được trong cùng transaction.
  const guard = await withPublic(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, status: true } });
    if (!tenant || tenant.status !== "ACTIVE") return null;
    const product = await tx.product.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: productSlug } },
      select: { id: true, status: true },
    });
    if (!product || product.status !== "PUBLISHED") return null;
    return { tenantId: tenant.id, productId: product.id };
  });
  if (!guard) return null;
  const { tenantId, productId } = guard;

  // Bước 2 (withTenant, chỉ sau khi đã qua guard): policy public của `product_files` chỉ cho thấy file preview
  // (`isPreview = true`) nên không đọc được file bán. Dùng scope tenant của chính gian hàng đã kiểm — hẹp hơn
  // system_job, đồng nhất với `listPublicPreviewFiles`.
  const file = await withTenant(tenantId, (tx) =>
    tx.productFile.findUnique({
      where: { id: fileId },
      include: { productFilePreview: true },
    }),
  );
  if (!file) return null;
  if (file.productId !== productId || file.tenantId !== tenantId) return null;
  if (file.sourceKind !== "FILE") return null;
  if (file.scanStatus !== "CLEAN") return null;
  if (file.removedAt !== null) return null;
  if (file.isPreview) return null;

  let cache = file.productFilePreview;
  if (!cache) {
    await generateAndStorePreview(file.id);
    cache = await withTenant(tenantId, (tx) => tx.productFilePreview.findUnique({ where: { productFileId: file.id } }));
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
  const kind = cache.kind as PreviewKind;
  const totalEstimate: Record<string, number> = {};
  if (kind === "pdf" && typeof (payload as PdfPayload).pageCount === "number") {
    totalEstimate.pageCount = (payload as PdfPayload).pageCount;
  }
  if (kind === "docx" && typeof (payload as DocxPayload).totalParagraphs === "number") {
    totalEstimate.totalParagraphs = (payload as DocxPayload).totalParagraphs;
  }
  if (kind === "xlsx" && typeof (payload as XlsxPayload).totalRows === "number") {
    totalEstimate.totalRows = (payload as XlsxPayload).totalRows;
  }
  if (kind === "pptx" && typeof (payload as PptxPayload).totalSlides === "number") {
    totalEstimate.slideCount = (payload as PptxPayload).totalSlides;
  }
  if ((kind === "text" || kind === "pdf") && typeof (payload as TextPayload).totalChars === "number") {
    totalEstimate.totalChars = (payload as TextPayload).totalChars;
  }

  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    kind,
    payload,
    ratio: cache.ratio,
    totalEstimate,
  };
}
