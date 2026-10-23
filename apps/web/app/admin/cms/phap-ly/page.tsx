import { LEGAL_DOCUMENT_DEFS, legalDocumentPath, pickEffectiveLegalVersion } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { listLegalVersions } from "../../../../lib/legal";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, Notice } from "../../_ui/kit";
import { LegalEditor, type LegalVersionView } from "./legal-editor";

/**
 * ADR-050 mục 3 — editor văn bản pháp lý (đợt 1: chỉ Điều khoản sử dụng). Segment tĩnh `phap-ly` thắng `[slug]`.
 * Wrapper <div>: layout admin đã có <main>.
 */
export default async function AdminLegalPage() {
  await requireAdminAccess("/admin/cms/phap-ly");
  const key = "terms" as const;
  const versions = await listLegalVersions(LEGAL_DOCUMENT_DEFS[key].key);
  const now = new Date();
  const effective = pickEffectiveLegalVersion(versions, now);
  const fmt = (date: Date | null) =>
    date ? date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  const views: LegalVersionView[] = versions.map((v) => ({
    id: v.id,
    version: v.version,
    status: v.status,
    reviewStatus: v.reviewStatus,
    contentHtml: v.contentHtml,
    changeSummary: v.changeSummary ?? "",
    effectiveAtLabel: fmt(v.effectiveAt),
    publishedAtLabel: fmt(v.publishedAt),
    updatedAtLabel: fmt(v.updatedAt)!,
    updatedAtIso: v.updatedAt.toISOString(),
    isEffective: effective?.id === v.id,
    isScheduled: v.status === "PUBLISHED" && v.effectiveAt !== null && v.effectiveAt.getTime() > now.getTime(),
  }));

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={`Văn bản pháp lý — ${LEGAL_DOCUMENT_DEFS[key].title}`}
        subtitle={`Trang công khai: ${legalDocumentPath(key)}. Mỗi lần thay đổi là một phiên bản mới; bản đã xuất bản không sửa được.`}
      />
      <div className="mt-6 space-y-3">
        <Notice tone="info">
          Chỉ xuất bản được khi đã tích “Đã rà soát pháp lý” và nội dung không còn dấu <code>[[CẦN XÁC NHẬN</code>. Dùng <code>{"{brand}"}</code> thay cho tên nền tảng.
          Bản đang hiệu lực = bản đã xuất bản mới nhất có ngày hiệu lực ≤ hiện tại; khi có bản hiệu lực, form đăng ký hiện link và ghi chấp thuận theo phiên bản.
        </Notice>
        {effective ? null : <Notice tone="warning">Chưa có bản đang hiệu lực — trang công khai trả 404, đăng ký giữ như cũ (không ghi chấp thuận theo phiên bản).</Notice>}
      </div>
      <LegalEditor documentKey={key} versions={views} />
    </div>
  );
}
