import {
  ABUSE_REPORT_DECISION_LABELS,
  ABUSE_REPORT_ERROR_CODES,
  ABUSE_REPORT_NOTE_MAX_LENGTH,
  ABUSE_REPORT_RATE_LIMIT,
  ABUSE_REPORT_RATE_WINDOW_MS,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_TARGET_TYPE_LABELS,
  allowedAbuseDecisions,
  AppError,
  htmlToPlainText,
  isAbuseReportDecision,
  isAbuseReportStatus,
  isAbuseReportType,
  isAbuseTargetType,
  isEnforcementDecision,
  logger,
  normalizeReportText,
  productPath,
  rateLimited,
  type AbuseReportDecisionValue,
  type AbuseReportStatusValue,
  type AbuseReportSubmission,
  type AbuseReportTypeValue,
  type AbuseTargetTypeValue,
} from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withPublic, withSystemJob, type Prisma, type Tx } from "@gieochu/db";
import { renderAbuseReportResolvedEmail, renderContentModeratedEmail } from "@gieochu/email";
import { audit } from "./audit";
import { getEffectiveBrand } from "./branding";
import { sendEmailNow } from "./email-dispatch";
import { recomputeProductRatings } from "./review";
import { requireRole, type CurrentUser } from "./session";
import { notifyPurchaseRemedyOpened, openPurchaseRemedies, type PurchaseRemedyNotification } from "./entitlement-remedy";
import { auditTenantLocked, lockTenantInTx } from "./tenant-lock";

/**
 * ADR-038 (M12c) — báo cáo vi phạm.
 *
 * Lớp dữ liệu:
 *  - `abuse_reports` là bảng L1 (không RLS): route `POST /api/reports` chỉ INSERT; mọi hàm đọc/xử lý là của System Admin
 *    (`requireRole("SYSTEM_ADMIN")` kiểm lại ngay trong loader/hàm, không tin trang gọi). Tenant KHÔNG có đường đọc nào
 *    → danh tính/email người báo cáo không bao giờ tới tenant (ADR-038 mục 4).
 *  - Đối tượng bị báo cáo nằm ở bảng L2 (products/reviews/posts): người gửi kiểm "tồn tại + công khai" qua `withPublic`;
 *    admin xem nội dung và áp biện pháp qua `withSystemJob` (cùng transaction với việc chốt trạng thái báo cáo).
 *  - §7.9: admin chỉ thấy NỘI DUNG đánh giá (sao + văn bản), không userId/tên hiển thị/đơn hàng của khách.
 *
 * Khoá kiểm duyệt (`moderationLockedAt` + `moderationReason` = nhãn loại vi phạm): đặt khi ẩn/lưu trữ; trigger
 * `<bảng>_guard_moderation` chặn tenant đổi trạng thái hiển thị cho tới khi admin gỡ khoá (`unlockModeration`).
 *
 * Code lên trước migration M12c: bảng chưa có (P2021) → gửi báo cáo trả 503 `REPORT_UNAVAILABLE`, trang admin hiện
 * "chưa sẵn sàng". (Cột mới trên products/reviews/posts thì KHÔNG xử lý mềm được — migration phải chạy trước deploy.)
 */

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
const EXCERPT_LENGTH = 160;
const POST_BODY_TEXT_MAX = 5000;
const POST_HIDDEN_REASON_MAX = 500;

export const ABUSE_REPORTS_PAGE_SIZE_DEFAULT = 20;

/** Bảng `abuse_reports` chưa tồn tại (code lên trước migration) — P2021 hoặc 42P01. */
function isReportsTableMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|abuse_reports.*does not exist|does not exist.*abuse_reports/i.test(text);
}

function reportsUnavailable(): AppError {
  return new AppError({
    code: ABUSE_REPORT_ERROR_CODES.UNAVAILABLE,
    message: "Chức năng báo cáo vi phạm đang được cập nhật, vui lòng thử lại sau.",
    httpStatus: 503,
  });
}

function reportNotFound(): AppError {
  return new AppError({ code: ABUSE_REPORT_ERROR_CODES.NOT_FOUND, message: "Không tìm thấy báo cáo.", httpStatus: 404 });
}

function excerpt(value: string | null | undefined, max = EXCERPT_LENGTH): string | null {
  if (!value) return null;
  const chars = Array.from(value.replace(/\s+/g, " ").trim());
  if (chars.length === 0) return null;
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : chars.join("");
}

function truncateCodePoints(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join("") : value;
}

// ───────────────────────── Gửi báo cáo (POST /api/reports) ─────────────────────────

export interface SubmitAbuseReportInput {
  submission: AbuseReportSubmission;
  /** Người dùng đang đăng nhập (null = khách vãng lai). */
  user: CurrentUser | null;
  /** IP đã chuẩn hoá (≤64 ký tự) hoặc null. */
  ip: string | null;
  userAgent: string | null;
}

export type SubmitAbuseReportResult = { kind: "created"; id: string } | { kind: "ignored" };

/**
 * Đối tượng phải tồn tại và đang công khai. Đọc dưới `withPublic` — RLS là cổng thật (sản phẩm PUBLISHED; đánh giá
 * VISIBLE của sản phẩm PUBLISHED; bài PUBLISHED của tenant không LOCKED) + gian hàng phải ACTIVE (ADR-040). Trả `tenantId`
 * của đối tượng.
 */
async function resolvePublicTarget(targetType: AbuseTargetTypeValue, targetId: string): Promise<string | null> {
  const row = await withPublic(async (tx) => {
    switch (targetType) {
      case "PRODUCT":
        return tx.product.findFirst({ where: { id: targetId, status: "PUBLISHED" }, select: { tenantId: true } });
      case "REVIEW":
        return tx.review.findFirst({ where: { id: targetId, status: "VISIBLE", product: { status: "PUBLISHED" } }, select: { tenantId: true } });
      case "POST":
        return tx.post.findFirst({ where: { id: targetId, status: "PUBLISHED" }, select: { tenantId: true } });
    }
  });
  if (!row) return null;
  // ADR-040: chỉ gian hàng ACTIVE công khai tài liệu/bài viết/đánh giá (READ_ONLY → khách thấy trang "tạm ngưng",
  // LOCKED → 404) — đối tượng của gian hàng khác ACTIVE coi như không công khai. tenants không bật RLS.
  const tenant = await getPrismaClient().tenant.findUnique({ where: { id: row.tenantId }, select: { status: true } });
  return tenant && tenant.status === "ACTIVE" ? row.tenantId : null;
}

export async function submitAbuseReport(input: SubmitAbuseReportInput): Promise<SubmitAbuseReportResult> {
  const { submission, user } = input;
  // Honeypot: bot điền ô ẩn → trả thành công giả, không ghi gì (không cho bot biết đã bị phát hiện).
  if (submission.website && submission.website.trim() !== "") {
    logger.info({ targetType: submission.targetType }, "abuse_report: honeypot triggered — bỏ qua");
    return { kind: "ignored" };
  }

  const prisma = getPrismaClient();
  let reporterUserId: string | null = null;
  let reporterEmail: string | undefined = submission.email;
  if (user) {
    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, email: true } });
    if (account) {
      reporterUserId = account.id;
      reporterEmail = account.email.toLowerCase();
    }
  }
  if (!reporterEmail) {
    throw new AppError({ code: ABUSE_REPORT_ERROR_CODES.EMAIL_REQUIRED, message: "Vui lòng nhập email để chúng tôi phản hồi kết quả xử lý.", httpStatus: 400 });
  }

  const tenantId = await resolvePublicTarget(submission.targetType, submission.targetId);
  if (!tenantId) {
    throw new AppError({ code: ABUSE_REPORT_ERROR_CODES.TARGET_NOT_FOUND, message: "Không tìm thấy nội dung cần báo cáo hoặc nội dung không còn công khai.", httpStatus: 404 });
  }

  const ip = input.ip;
  let id: string;
  try {
    id = await prisma.$transaction(async (tx) => {
      // Tuần tự hoá theo IP rồi theo đối tượng (thứ tự cố định → không deadlock) để giới hạn/chặn trùng không bị vượt
      // khi gửi đồng thời.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`abuse-report-ip:${ip ?? "unknown"}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`abuse-report-target:${submission.targetType}:${submission.targetId}`}))`;

      const since = new Date(Date.now() - ABUSE_REPORT_RATE_WINDOW_MS);
      const recent = await tx.abuseReport.count({ where: { ip: ip ?? null, createdAt: { gte: since } } });
      if (recent >= ABUSE_REPORT_RATE_LIMIT) {
        throw rateLimited("Bạn đã gửi khá nhiều báo cáo trong một giờ qua. Vui lòng thử lại sau nhé.");
      }

      const duplicate = await tx.abuseReport.findFirst({
        where: {
          targetType: submission.targetType,
          targetId: submission.targetId,
          status: "OPEN",
          OR: [{ reporterEmail }, ...(reporterUserId ? [{ reporterUserId }] : [])],
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError({ code: ABUSE_REPORT_ERROR_CODES.DUPLICATE, message: "Bạn đã báo cáo nội dung này và báo cáo đang chờ xử lý.", httpStatus: 409 });
      }

      const created = await tx.abuseReport.create({
        data: {
          targetType: submission.targetType,
          targetId: submission.targetId,
          tenantId,
          type: submission.type,
          description: submission.description,
          evidenceUrls: submission.evidenceUrls,
          reporterUserId,
          reporterEmail,
          ip,
        },
        select: { id: true },
      });
      return created.id;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isReportsTableMissing(error)) {
      logger.warn("abuse_report: bảng abuse_reports chưa có (migration M12c chưa áp)");
      throw reportsUnavailable();
    }
    throw error;
  }

  // tenantId = null CÓ CHỦ ĐÍCH: dòng có tenantId hiện ở Studio → Hoạt động của chủ gian hàng (kèm actor đã che) — lộ
  // việc bị báo cáo/khách nào báo cáo. Metadata không chứa email/mô tả.
  await audit.log({
    actorId: reporterUserId,
    scope: reporterUserId ? "CUSTOMER" : "SYSTEM",
    tenantId: null,
    action: "REPORT_SUBMITTED",
    targetType: "AbuseReport",
    targetId: id,
    metadata: { targetType: submission.targetType, targetId: submission.targetId, reportType: submission.type, targetTenantId: tenantId, guest: !reporterUserId },
    ip,
    userAgent: input.userAgent,
  });
  return { kind: "created", id };
}

// ───────────────────────── Admin: danh sách ─────────────────────────

export interface AbuseReportListFilters {
  status: AbuseReportStatusValue | null;
  type: AbuseReportTypeValue | null;
  targetType: AbuseTargetTypeValue | null;
}

export interface AbuseReportSearchParams {
  status?: string;
  type?: string;
  targetType?: string;
}

export function parseAbuseReportFilters(sp: AbuseReportSearchParams): AbuseReportListFilters {
  return {
    // Mặc định xem báo cáo chờ xử lý; `status=ALL` = mọi trạng thái.
    status: sp.status === "ALL" ? null : isAbuseReportStatus(sp.status) ? sp.status : "OPEN",
    type: isAbuseReportType(sp.type) ? sp.type : null,
    targetType: isAbuseTargetType(sp.targetType) ? sp.targetType : null,
  };
}

export interface AbuseReportListItem {
  id: string;
  createdAt: Date;
  status: AbuseReportStatusValue;
  type: AbuseReportTypeValue;
  targetType: AbuseTargetTypeValue;
  targetId: string;
  decision: AbuseReportDecisionValue | null;
  /** Chỉ admin thấy (ADR-038 mục 4). */
  reporterEmail: string;
  isGuest: boolean;
  descriptionExcerpt: string;
  tenant: { id: string; name: string; slug: string; status: string } | null;
  /** Tiêu đề/trích đoạn đối tượng hiện tại; null = đối tượng đã bị xoá. */
  targetTitle: string | null;
}

export type AbuseReportListResult =
  | { status: "ok"; items: AbuseReportListItem[]; total: number; openCount: number; filters: AbuseReportListFilters }
  | { status: "unavailable"; filters: AbuseReportListFilters };

/** Tiêu đề hiện tại của các đối tượng (1 transaction system_job, 3 truy vấn theo loại). */
async function loadTargetTitles(refs: readonly { targetType: AbuseTargetTypeValue; targetId: string }[]): Promise<Map<string, string>> {
  const ids = (type: AbuseTargetTypeValue) => [...new Set(refs.filter((r) => r.targetType === type).map((r) => r.targetId))];
  const productIds = ids("PRODUCT");
  const reviewIds = ids("REVIEW");
  const postIds = ids("POST");
  if (productIds.length + reviewIds.length + postIds.length === 0) return new Map();
  return withSystemJob(async (tx) => {
    const map = new Map<string, string>();
    const [products, reviews, posts] = await Promise.all([
      productIds.length ? tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } }) : [],
      reviewIds.length
        ? tx.review.findMany({ where: { id: { in: reviewIds } }, select: { id: true, rating: true, body: true, product: { select: { title: true } } } })
        : [],
      postIds.length ? tx.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, excerpt: true } }) : [],
    ]);
    for (const p of products) map.set(`PRODUCT:${p.id}`, p.title);
    for (const r of reviews) map.set(`REVIEW:${r.id}`, `${r.rating}★ · ${r.product.title}${r.body ? ` — ${excerpt(r.body, 80)}` : ""}`);
    for (const p of posts) map.set(`POST:${p.id}`, p.title ?? excerpt(p.excerpt, 80) ?? "Bài viết (chỉ có ảnh)");
    return map;
  });
}

/** `/admin/reports` — mới nhất trước. `skip/take` từ `parsePagination` của trang. */
export async function listAbuseReports(
  sp: AbuseReportSearchParams,
  paging: { skip: number; take: number },
): Promise<AbuseReportListResult> {
  await requireRole("SYSTEM_ADMIN");
  const filters = parseAbuseReportFilters(sp);
  const where: Prisma.AbuseReportWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.targetType ? { targetType: filters.targetType } : {}),
  };
  const prisma = getPrismaClient();
  try {
    const [rows, total, openCount] = await Promise.all([
      prisma.abuseReport.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: paging.skip,
        take: paging.take,
        select: {
          id: true,
          createdAt: true,
          status: true,
          type: true,
          targetType: true,
          targetId: true,
          decision: true,
          reporterEmail: true,
          reporterUserId: true,
          description: true,
          tenant: { select: { id: true, name: true, slug: true, status: true } },
        },
      }),
      prisma.abuseReport.count({ where }),
      prisma.abuseReport.count({ where: { status: "OPEN" } }),
    ]);
    const titles = await loadTargetTitles(rows);
    return {
      status: "ok",
      total,
      openCount,
      filters,
      items: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        status: r.status,
        type: r.type,
        targetType: r.targetType,
        targetId: r.targetId,
        decision: r.decision,
        reporterEmail: r.reporterEmail,
        isGuest: r.reporterUserId === null,
        descriptionExcerpt: excerpt(r.description) ?? "",
        tenant: r.tenant,
        targetTitle: titles.get(`${r.targetType}:${r.targetId}`) ?? null,
      })),
    };
  } catch (error) {
    if (isReportsTableMissing(error)) return { status: "unavailable", filters };
    throw error;
  }
}

/** Số báo cáo đang chờ (badge sidebar/tổng quan). Bảng chưa có → 0. */
export async function countOpenAbuseReports(): Promise<number> {
  await requireRole("SYSTEM_ADMIN");
  try {
    return await getPrismaClient().abuseReport.count({ where: { status: "OPEN" } });
  } catch (error) {
    if (isReportsTableMissing(error)) return 0;
    throw error;
  }
}

// ───────────────────────── Admin: chi tiết ─────────────────────────

interface ModerationState {
  moderationLockedAt: Date | null;
  moderationReason: string | null;
}

export type AbuseReportTargetView =
  | ({ kind: "PRODUCT"; id: string; title: string; summary: string | null; status: string; publicPath: string | null } & ModerationState)
  /** §7.9: chỉ nội dung — không userId, tên hiển thị hay đơn hàng của khách. */
  | ({ kind: "REVIEW"; id: string; rating: number; body: string | null; status: string; productTitle: string; publicPath: string | null } & ModerationState)
  | ({ kind: "POST"; id: string; title: string | null; excerpt: string; bodyText: string; status: string; publicPath: string | null } & ModerationState);

export interface AbuseReportDetail {
  id: string;
  status: AbuseReportStatusValue;
  type: AbuseReportTypeValue;
  targetType: AbuseTargetTypeValue;
  targetId: string;
  description: string;
  evidenceUrls: string[];
  reporterEmail: string;
  reporterUserId: string | null;
  ip: string | null;
  decision: AbuseReportDecisionValue | null;
  resolutionNote: string | null;
  resolvedAt: Date | null;
  resolvedByEmail: string | null;
  createdAt: Date;
  tenant: { id: string; name: string; slug: string; status: string };
  /** null = đối tượng đã bị xoá. */
  target: AbuseReportTargetView | null;
  /** Báo cáo OPEN KHÁC cùng đối tượng (gợi ý "áp cùng quyết định"). */
  otherOpenReports: number;
  allowedDecisions: AbuseReportDecisionValue[];
}

async function loadTargetView(tx: Tx, targetType: AbuseTargetTypeValue, targetId: string, tenantSlug: string): Promise<AbuseReportTargetView | null> {
  const moderation = { moderationLockedAt: true, moderationReason: true } as const;
  switch (targetType) {
    case "PRODUCT": {
      const p = await tx.product.findUnique({ where: { id: targetId }, select: { id: true, title: true, summary: true, slug: true, status: true, ...moderation } });
      if (!p) return null;
      return {
        kind: "PRODUCT",
        id: p.id,
        title: p.title,
        summary: p.summary,
        status: p.status,
        publicPath: p.status === "PUBLISHED" ? productPath(tenantSlug, p.slug) : null,
        moderationLockedAt: p.moderationLockedAt,
        moderationReason: p.moderationReason,
      };
    }
    case "REVIEW": {
      const r = await tx.review.findUnique({
        where: { id: targetId },
        select: { id: true, rating: true, body: true, status: true, ...moderation, product: { select: { title: true, slug: true, status: true } } },
      });
      if (!r) return null;
      return {
        kind: "REVIEW",
        id: r.id,
        rating: r.rating,
        body: r.body,
        status: r.status,
        productTitle: r.product.title,
        publicPath: r.product.status === "PUBLISHED" ? productPath(tenantSlug, r.product.slug) : null,
        moderationLockedAt: r.moderationLockedAt,
        moderationReason: r.moderationReason,
      };
    }
    case "POST": {
      const p = await tx.post.findUnique({ where: { id: targetId }, select: { id: true, title: true, excerpt: true, body: true, status: true, ...moderation } });
      if (!p) return null;
      return {
        kind: "POST",
        id: p.id,
        title: p.title,
        excerpt: p.excerpt,
        // Văn bản thuần (không render HTML trong trang admin).
        bodyText: truncateCodePoints(htmlToPlainText(p.body), POST_BODY_TEXT_MAX),
        status: p.status,
        publicPath: p.status === "PUBLISHED" ? `/${tenantSlug}/posts/${p.id}` : null,
        moderationLockedAt: p.moderationLockedAt,
        moderationReason: p.moderationReason,
      };
    }
  }
}

/** `/admin/reports/[reportId]`. Không có → `REPORT_NOT_FOUND`; bảng chưa có → `REPORT_UNAVAILABLE`. */
export async function getAbuseReportDetail(reportId: string): Promise<AbuseReportDetail> {
  await requireRole("SYSTEM_ADMIN");
  if (!ID_PATTERN.test(reportId)) throw reportNotFound();
  try {
    return await withSystemJob(async (tx) => {
      const report = await tx.abuseReport.findUnique({
        where: { id: reportId },
        include: { tenant: { select: { id: true, name: true, slug: true, status: true } }, resolvedBy: { select: { email: true } } },
      });
      if (!report) throw reportNotFound();
      const [target, otherOpenReports] = await Promise.all([
        loadTargetView(tx, report.targetType, report.targetId, report.tenant.slug),
        tx.abuseReport.count({ where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN", id: { not: report.id } } }),
      ]);
      return {
        id: report.id,
        status: report.status,
        type: report.type,
        targetType: report.targetType,
        targetId: report.targetId,
        description: report.description,
        evidenceUrls: report.evidenceUrls,
        reporterEmail: report.reporterEmail,
        reporterUserId: report.reporterUserId,
        ip: report.ip,
        decision: report.decision,
        resolutionNote: report.resolutionNote,
        resolvedAt: report.resolvedAt,
        resolvedByEmail: report.resolvedBy?.email ?? null,
        createdAt: report.createdAt,
        tenant: report.tenant,
        target,
        otherOpenReports,
        allowedDecisions: allowedAbuseDecisions(report.targetType),
      };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isReportsTableMissing(error)) throw reportsUnavailable();
    throw error;
  }
}

// ───────────────────────── Admin: xử lý ─────────────────────────

export interface ResolveAbuseReportInput {
  decision: unknown;
  note?: unknown;
  /**
   * Lựa chọn của admin: đóng luôn MỌI báo cáo OPEN khác cùng đối tượng bằng cùng quyết định + ghi chú (mỗi người báo
   * cáo đều nhận email kết quả). false = chỉ đóng báo cáo này; báo cáo khác vẫn OPEN để xem riêng.
   */
  applyToSameTarget?: boolean;
}

/** Dữ liệu gửi email sau khi commit — không chứa ghi chú nội bộ. */
export interface AbuseReportNotification {
  decision: AbuseReportDecisionValue;
  reportType: AbuseReportTypeValue;
  targetType: AbuseTargetTypeValue;
  targetId: string;
  reporterEmails: string[];
  tenant: { id: string; name: string; slug: string; ownerEmail: string };
  contentSummary: string | null;
  /**
   * ADR-039: có giá trị khi lưu trữ tài liệu mở quyền chọn cho ≥1 người mua. Chỉ id — danh sách khách được nạp lại lúc
   * gửi email (`notifyPurchaseRemedyOpened`), không đi qua kết quả của admin.
   */
  purchaseRemedy: PurchaseRemedyNotification | null;
}

export interface ResolveAbuseReportResult {
  status: AbuseReportStatusValue;
  decision: AbuseReportDecisionValue;
  resolvedReportIds: string[];
  tenantSlug: string;
  /** Có giá trị khi đối tượng là tài liệu (để revalidate trang công khai). */
  productSlug: string | null;
  notification: AbuseReportNotification;
}

interface AppliedAction {
  contentSummary: string | null;
  productSlug: string | null;
  reviewProductId: string | null;
  moderationLocked: boolean;
  tenantPreviousStatus: string | null;
  /** ADR-039: số entitlement vừa chuyển PENDING_CHOICE (chỉ ARCHIVE_PRODUCT). */
  remediesOpened: number;
}

function targetGone(): AppError {
  return new AppError({
    code: ABUSE_REPORT_ERROR_CODES.TARGET_GONE,
    message: "Nội dung không còn tồn tại — hãy chọn Bác bỏ hoặc Khoá gian hàng.",
    httpStatus: 409,
  });
}

/** Tóm tắt đối tượng cho email chủ gian hàng (tiêu đề / trích đoạn; không danh tính khách). */
async function summarizeTarget(tx: Tx, targetType: AbuseTargetTypeValue, targetId: string, tenantId: string): Promise<{ summary: string | null; productSlug: string | null }> {
  switch (targetType) {
    case "PRODUCT": {
      const p = await tx.product.findFirst({ where: { id: targetId, tenantId }, select: { title: true, slug: true } });
      return { summary: p?.title ?? null, productSlug: p?.slug ?? null };
    }
    case "REVIEW": {
      const r = await tx.review.findFirst({ where: { id: targetId, tenantId }, select: { rating: true, body: true, product: { select: { title: true } } } });
      return { summary: r ? `Đánh giá ${r.rating}★ cho "${r.product.title}"${r.body ? `: ${excerpt(r.body, 120)}` : ""}` : null, productSlug: null };
    }
    case "POST": {
      const p = await tx.post.findFirst({ where: { id: targetId, tenantId }, select: { title: true, excerpt: true } });
      return { summary: p ? (p.title ?? excerpt(p.excerpt, 120) ?? "Bài viết") : null, productSlug: null };
    }
  }
}

async function applyDecision(
  tx: Tx,
  report: { id: string; targetType: AbuseTargetTypeValue; targetId: string; tenantId: string; type: AbuseReportTypeValue },
  decision: AbuseReportDecisionValue,
  now: Date,
): Promise<AppliedAction> {
  const reason = ABUSE_REPORT_TYPE_LABELS[report.type];
  const { summary, productSlug } = await summarizeTarget(tx, report.targetType, report.targetId, report.tenantId);
  const base: AppliedAction = {
    contentSummary: summary,
    productSlug,
    reviewProductId: null,
    moderationLocked: false,
    tenantPreviousStatus: null,
    remediesOpened: 0,
  };

  switch (decision) {
    case "REJECT":
      return base;
    case "LOCK_TENANT": {
      const locked = await lockTenantInTx(tx, report.tenantId);
      return { ...base, tenantPreviousStatus: locked?.previousStatus ?? null };
    }
    case "ARCHIVE_PRODUCT": {
      const product = await tx.product.findFirst({ where: { id: report.targetId, tenantId: report.tenantId }, select: { id: true } });
      if (!product) throw targetGone();
      await tx.product.update({ where: { id: product.id }, data: { status: "ARCHIVED", moderationLockedAt: now, moderationReason: reason } });
      // ADR-039: người mua (entitlement chưa thu hồi) bị chặn tải tới khi chọn tải lần cuối / yêu cầu hoàn tiền — cùng
      // transaction với việc lưu trữ (lỗi → không đổi gì).
      const remediesOpened = await openPurchaseRemedies(tx, { tenantId: report.tenantId, productId: product.id, reportId: report.id, now });
      return { ...base, moderationLocked: true, remediesOpened };
    }
    case "HIDE_CONTENT": {
      if (report.targetType === "REVIEW") {
        const review = await tx.review.findFirst({
          where: { id: report.targetId, tenantId: report.tenantId },
          select: { id: true, status: true, hiddenReason: true, hiddenAt: true, productId: true },
        });
        if (!review) throw targetGone();
        const alreadyHidden = review.status === "HIDDEN" && review.hiddenReason !== null;
        await tx.review.update({
          where: { id: review.id },
          data: {
            status: "HIDDEN",
            // Đã ẩn (do tenant / hoàn tiền) thì giữ lý do cũ; chưa ẩn → OTHER (nhãn kiểm duyệt nằm ở moderationReason).
            hiddenReason: alreadyHidden ? review.hiddenReason : "OTHER",
            hiddenAt: alreadyHidden ? (review.hiddenAt ?? now) : now,
            moderationLockedAt: now,
            moderationReason: reason,
          },
        });
        return { ...base, moderationLocked: true, reviewProductId: review.productId };
      }
      if (report.targetType === "POST") {
        const post = await tx.post.findFirst({ where: { id: report.targetId, tenantId: report.tenantId }, select: { id: true } });
        if (!post) throw targetGone();
        await tx.post.update({
          where: { id: post.id },
          data: {
            status: "HIDDEN",
            hiddenReason: truncateCodePoints(reason, POST_HIDDEN_REASON_MAX),
            // Bài ẩn không còn là bài ghim (tenant không tự bỏ ghim bài HIDDEN được).
            isPinned: false,
            moderationLockedAt: now,
            moderationReason: reason,
          },
        });
        return { ...base, moderationLocked: true };
      }
      throw invalidDecision();
    }
  }
}

function invalidDecision(): AppError {
  return new AppError({ code: ABUSE_REPORT_ERROR_CODES.INVALID_DECISION, message: "Quyết định không phù hợp với loại nội dung bị báo cáo.", httpStatus: 400 });
}

/**
 * Xử lý 1 báo cáo OPEN: áp biện pháp + chốt trạng thái báo cáo trong CÙNG 1 transaction `withSystemJob` (lỗi ở bất kỳ
 * bước nào → không đổi gì). Sau commit: audit, tính lại điểm sản phẩm (đánh giá bị ẩn). Email KHÔNG gửi ở đây — caller
 * gọi `notifyAbuseReportResolution(result.notification)` (thường trong `after()`).
 */
export async function resolveAbuseReport(actor: CurrentUser, reportId: string, input: ResolveAbuseReportInput): Promise<ResolveAbuseReportResult> {
  if (actor.role !== "SYSTEM_ADMIN") throw new AppError({ code: "FORBIDDEN", message: "Không có quyền truy cập", httpStatus: 403 });
  if (!ID_PATTERN.test(reportId)) throw reportNotFound();
  if (!isAbuseReportDecision(input.decision)) throw invalidDecision();
  const decision = input.decision;
  const note = typeof input.note === "string" ? normalizeReportText(input.note) : "";
  if (Array.from(note).length > ABUSE_REPORT_NOTE_MAX_LENGTH) {
    throw new AppError({ code: "VALIDATION_ERROR", message: `Ghi chú tối đa ${ABUSE_REPORT_NOTE_MAX_LENGTH} ký tự.`, httpStatus: 400 });
  }
  const applyToSameTarget = input.applyToSameTarget === true;
  const status: AbuseReportStatusValue = decision === "REJECT" ? "REJECTED" : "RESOLVED";
  const now = new Date();

  let outcome: {
    report: { id: string; targetType: AbuseTargetTypeValue; targetId: string; tenantId: string; type: AbuseReportTypeValue };
    applied: AppliedAction;
    resolvedIds: string[];
    reporterEmails: string[];
    tenant: { id: string; name: string; slug: string; ownerEmail: string };
  };
  try {
    outcome = await withSystemJob(async (tx) => {
      const report = await tx.abuseReport.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, targetType: true, targetId: true, tenantId: true, type: true, reporterEmail: true },
      });
      if (!report) throw reportNotFound();
      if (report.status !== "OPEN") {
        throw new AppError({ code: ABUSE_REPORT_ERROR_CODES.ALREADY_RESOLVED, message: "Báo cáo này đã được xử lý.", httpStatus: 409 });
      }
      if (!allowedAbuseDecisions(report.targetType).includes(decision)) throw invalidDecision();

      const applied = await applyDecision(tx, report, decision, now);

      const data = { status, decision, resolutionNote: note || null, resolvedById: actor.userId, resolvedAt: now };
      // Chốt có điều kiện status = OPEN: 2 admin xử lý cùng lúc → người sau nhận 409 và transaction của họ rollback.
      const claimed = await tx.abuseReport.updateMany({ where: { id: report.id, status: "OPEN" }, data });
      if (claimed.count === 0) {
        throw new AppError({ code: ABUSE_REPORT_ERROR_CODES.ALREADY_RESOLVED, message: "Báo cáo này vừa được xử lý bởi người khác.", httpStatus: 409 });
      }

      const siblings = applyToSameTarget
        ? await tx.abuseReport.findMany({
            where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN", id: { not: report.id } },
            select: { id: true, reporterEmail: true },
          })
        : [];
      if (siblings.length > 0) {
        await tx.abuseReport.updateMany({ where: { id: { in: siblings.map((s) => s.id) }, status: "OPEN" }, data });
      }

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: report.tenantId },
        select: { id: true, name: true, slug: true, owner: { select: { email: true } } },
      });
      return {
        report,
        applied,
        resolvedIds: [report.id, ...siblings.map((s) => s.id)],
        reporterEmails: [...new Set([report.reporterEmail, ...siblings.map((s) => s.reporterEmail)])],
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, ownerEmail: tenant.owner.email },
      };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isReportsTableMissing(error)) throw reportsUnavailable();
    throw error;
  }

  const { report, applied } = outcome;
  // Dòng REPORT_RESOLVED không gắn tenantId (không hiện ở Studio → Hoạt động); metadata không email/ghi chú.
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    tenantId: null,
    action: "REPORT_RESOLVED",
    targetType: "AbuseReport",
    targetId: report.id,
    metadata: {
      decision,
      status,
      targetType: report.targetType,
      targetId: report.targetId,
      targetTenantId: report.tenantId,
      reportType: report.type,
      alsoResolved: outcome.resolvedIds.length - 1,
      applyToSameTarget,
    },
  });
  if (applied.moderationLocked) {
    // Gắn tenantId: chủ gian hàng thấy nội dung nào bị khoá (actor hiện "Quản trị hệ thống") — không có gì về người báo cáo.
    await audit.log({
      actorId: actor.userId,
      scope: "SYSTEM",
      tenantId: report.tenantId,
      action: "CONTENT_MODERATION_LOCKED",
      targetType: report.targetType,
      targetId: report.targetId,
      metadata: { decision, reportType: report.type },
    });
  }
  if (decision === "LOCK_TENANT" && applied.tenantPreviousStatus !== null && applied.tenantPreviousStatus !== "LOCKED") {
    // ADR-072: lý do sẵn có của luồng = nhãn loại vi phạm (KHÔNG dùng ghi chú nội bộ `note`). Email chủ gian hàng vẫn là
    // `content_moderated` (notifyAbuseReportResolution) — không gửi thêm email khoá gian hàng.
    await auditTenantLocked(actor.userId, report.tenantId, {
      source: "ABUSE_REPORT",
      reason: ABUSE_REPORT_TYPE_LABELS[report.type],
      reportType: report.type,
      previousStatus: applied.tenantPreviousStatus,
    });
  }
  if (applied.reviewProductId) await recomputeProductRatings([applied.reviewProductId]);

  return {
    status,
    decision,
    resolvedReportIds: outcome.resolvedIds,
    tenantSlug: outcome.tenant.slug,
    productSlug: applied.productSlug,
    notification: {
      decision,
      reportType: report.type,
      targetType: report.targetType,
      targetId: report.targetId,
      reporterEmails: outcome.reporterEmails,
      tenant: outcome.tenant,
      contentSummary: applied.contentSummary,
      purchaseRemedy:
        applied.remediesOpened > 0 ? { reportId: report.id, tenantId: report.tenantId, productId: report.targetId } : null,
    },
  };
}

async function loadSupportEmail(): Promise<string | null> {
  try {
    const row = await getPrismaClient().systemSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });
    return row?.supportEmail?.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, "abuse_report: không đọc được email hỗ trợ");
    return null;
  }
}

function studioUrlFor(n: AbuseReportNotification): string {
  const base = `${getEnv().APP_URL.replace(/\/+$/, "")}/studio/${n.tenant.slug}`;
  if (n.decision === "LOCK_TENANT") return base;
  switch (n.targetType) {
    case "PRODUCT":
      return `${base}/products/${n.targetId}`;
    case "REVIEW":
      return `${base}/reviews`;
    case "POST":
      return `${base}/posts/${n.targetId}`;
  }
}

/**
 * ADR-038 mục 6 — email sau khi xử lý: (1) mỗi người báo cáo nhận quyết định CHUNG; (2) chủ gian hàng nhận email khi có
 * biện pháp (ẩn/lưu trữ/khoá) — chỉ loại vi phạm + nội dung + quyết định, KHÔNG danh tính người báo cáo. Không bao giờ
 * ném: lỗi gửi chỉ log (không chặn việc xử lý đã commit).
 */
export async function notifyAbuseReportResolution(n: AbuseReportNotification): Promise<void> {
  try {
    const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), loadSupportEmail()]);
    const actionTaken = isEnforcementDecision(n.decision);
    const targetTypeLabel = ABUSE_TARGET_TYPE_LABELS[n.targetType];

    for (const to of n.reporterEmails) {
      const rendered = renderAbuseReportResolvedEmail({ appName: brand.name, targetTypeLabel, actionTaken, supportEmail });
      const result = await sendEmailNow({ type: "abuse_report_resolved", to, ...rendered });
      if (!result.ok) logger.warn({ error: result.error, targetType: n.targetType }, "abuse_report: gửi email cho người báo cáo thất bại");
    }

    if (actionTaken) {
      const rendered = renderContentModeratedEmail({
        appName: brand.name,
        tenantName: n.tenant.name,
        violationLabel: ABUSE_REPORT_TYPE_LABELS[n.reportType],
        decisionLabel: ABUSE_REPORT_DECISION_LABELS[n.decision],
        targetTypeLabel,
        contentSummary: n.contentSummary,
        tenantLocked: n.decision === "LOCK_TENANT",
        manageUrl: studioUrlFor(n),
        supportEmail,
      });
      const result = await sendEmailNow({ type: "content_moderated", to: n.tenant.ownerEmail, ...rendered });
      if (!result.ok) logger.warn({ tenantId: n.tenant.id, error: result.error }, "abuse_report: gửi email cho chủ gian hàng thất bại");
    }

    // ADR-039: email người mua (2 lựa chọn) + email tổng hợp cho chủ gian hàng. Tự bắt lỗi bên trong.
    if (n.purchaseRemedy) await notifyPurchaseRemedyOpened(n.purchaseRemedy, supportEmail);
  } catch (error) {
    logger.error({ err: error, targetType: n.targetType }, "abuse_report: lỗi khi gửi email kết quả xử lý");
  }
}

// ───────────────────────── Admin: gỡ khoá kiểm duyệt ─────────────────────────

export interface UnlockModerationResult {
  tenantSlug: string;
  productSlug: string | null;
}

/**
 * Gỡ khoá kiểm duyệt (admin). Sau khi gỡ:
 *  - Tài liệu: giữ ARCHIVED — tenant tự khôi phục/xuất bản lại (phải tích cam kết bản quyền).
 *  - Đánh giá: giữ HIDDEN — tenant tự bỏ ẩn được.
 *  - Bài viết: HIDDEN → DRAFT, bỏ lý do ẩn (tenant không tự gỡ HIDDEN được — trigger posts_guard_columns) — tenant tự
 *    đăng lại.
 */
export async function unlockModeration(actor: CurrentUser, targetType: unknown, targetId: unknown): Promise<UnlockModerationResult> {
  if (actor.role !== "SYSTEM_ADMIN") throw new AppError({ code: "FORBIDDEN", message: "Không có quyền truy cập", httpStatus: 403 });
  if (!isAbuseTargetType(targetType) || typeof targetId !== "string" || !ID_PATTERN.test(targetId)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Đối tượng không hợp lệ.", httpStatus: 400 });
  }
  const notLocked = () =>
    new AppError({ code: ABUSE_REPORT_ERROR_CODES.NOT_LOCKED, message: "Nội dung không bị khoá kiểm duyệt (hoặc không còn tồn tại).", httpStatus: 409 });

  const result = await withSystemJob(async (tx) => {
    switch (targetType) {
      case "PRODUCT": {
        const p = await tx.product.findUnique({ where: { id: targetId }, select: { id: true, tenantId: true, slug: true, moderationLockedAt: true } });
        if (!p?.moderationLockedAt) throw notLocked();
        await tx.product.update({ where: { id: p.id }, data: { moderationLockedAt: null, moderationReason: null } });
        return { tenantId: p.tenantId, productSlug: p.slug as string | null };
      }
      case "REVIEW": {
        const r = await tx.review.findUnique({ where: { id: targetId }, select: { id: true, tenantId: true, moderationLockedAt: true } });
        if (!r?.moderationLockedAt) throw notLocked();
        await tx.review.update({ where: { id: r.id }, data: { moderationLockedAt: null, moderationReason: null } });
        return { tenantId: r.tenantId, productSlug: null };
      }
      case "POST": {
        const p = await tx.post.findUnique({ where: { id: targetId }, select: { id: true, tenantId: true, moderationLockedAt: true } });
        if (!p?.moderationLockedAt) throw notLocked();
        await tx.post.update({ where: { id: p.id }, data: { moderationLockedAt: null, moderationReason: null, status: "DRAFT", hiddenReason: null } });
        return { tenantId: p.tenantId, productSlug: null };
      }
    }
  });
  const tenant = await getPrismaClient().tenant.findUniqueOrThrow({ where: { id: result.tenantId }, select: { slug: true } });
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    tenantId: result.tenantId,
    action: "CONTENT_MODERATION_UNLOCKED",
    targetType,
    targetId,
  });
  return { tenantSlug: tenant.slug, productSlug: result.productSlug };
}

// ───────────────────────── Retention (cron hằng ngày) ─────────────────────────

export interface AbuseReportIpPurgeResult {
  cleared: number;
  skipped: boolean;
}

/** ADR-038 mục 3: xoá IP (SET NULL) của báo cáo cũ hơn 12 tháng — giữ nguyên báo cáo. So theo UTC như audit purge. */
export async function purgeExpiredAbuseReportIps(): Promise<AbuseReportIpPurgeResult> {
  try {
    const cleared = await getPrismaClient().$executeRaw`
      UPDATE "abuse_reports" SET "ip" = NULL
      WHERE "ip" IS NOT NULL AND "createdAt" < (now() AT TIME ZONE 'UTC') - interval '12 months'
    `;
    return { cleared, skipped: false };
  } catch (error) {
    if (isReportsTableMissing(error)) {
      logger.warn("abuse_report.ip_purge: bảng abuse_reports chưa có (migration M12c chưa áp) — bỏ qua");
      return { cleared: 0, skipped: true };
    }
    throw error;
  }
}
