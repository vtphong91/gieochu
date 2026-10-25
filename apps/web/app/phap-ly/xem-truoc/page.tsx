import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  countLegalPlaceholders,
  isLegalDocumentKey,
  LEGAL_PREVIEW_PATH,
  LEGAL_REVIEW_STATUS_LABELS,
  LEGAL_VERSION_STATUS_LABELS,
  legalPreviewPath,
} from "@gieochu/core";
import { getEffectiveBrand } from "../../../lib/branding";
import { getLegalVersionForPreview } from "../../../lib/legal";
import { requireAdminAccess } from "../../../lib/page-guards";
import { LegalDocumentView } from "../../_ui/legal-document-page";

/**
 * ADR-057 mục 2 — xem trước một phiên bản chính sách (DRAFT/PUBLISHED/ARCHIVED) đúng giao diện trang công khai, CHỈ
 * SYSTEM_ADMIN (`requireAdminAccess`: chưa đăng nhập → /login, không phải admin → 404). Chỉ đọc, noindex.
 *
 * Đặt ngoài `/admin` có chủ đích: `LegalDocumentView` là trang đầy đủ (skip-link, SiteHeader, `<main>`, SiteFooter) mở ở tab
 * mới; trong app shell admin sẽ thành `<main>` lồng `<main>` + hai header. Segment `phap-ly` đã nằm trong `RESERVED_SLUGS`
 * (tenant không lấy được), segment tĩnh `xem-truoc` thắng `phap-ly/[slug]` (redirect 308 URL cũ). Query:
 * `?van-ban=<khoá>&phien-ban=<id>` (thiếu `phien-ban` → phiên bản mới nhất).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xem trước chính sách",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function single(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

export default async function LegalPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawKey = single(params["van-ban"]);
  const versionId = single(params["phien-ban"]);
  const key = rawKey && isLegalDocumentKey(rawKey) ? rawKey : null;
  await requireAdminAccess(key ? legalPreviewPath(key, versionId ?? undefined) : LEGAL_PREVIEW_PATH);
  if (!key) notFound();

  const [version, brand] = await Promise.all([getLegalVersionForPreview(key, versionId), getEffectiveBrand()]);
  if (!version) notFound();

  const placeholders = countLegalPlaceholders(version.contentHtml);
  const statusParts = [LEGAL_VERSION_STATUS_LABELS[version.status]];
  if (version.status === "DRAFT") statusParts.push(LEGAL_REVIEW_STATUS_LABELS[version.reviewStatus]);
  if (version.isDraftRelease) statusParts.push("Bản dự thảo");
  if (placeholders > 0) statusParts.push(`${placeholders} chỗ chưa xác nhận`);

  return (
    <LegalDocumentView
      title={version.title}
      version={version.version}
      effectiveAt={version.status === "DRAFT" ? null : version.effectiveAt}
      contentHtml={version.contentHtml}
      brandName={brand.name}
      isDraftRelease={version.isDraftRelease}
      preview={{ statusLabel: statusParts.join(" · "), backHref: `/admin/cms/phap-ly?van-ban=${key}` }}
    />
  );
}
