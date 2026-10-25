import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { isLegalDocumentKey, LEGAL_DOCUMENT_DEFS, LEGAL_DOCUMENT_KEYS, legalDocumentPath, pickEffectiveLegalVersion, type LegalDocumentKey } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { getLegalDocumentMeta, listLegalDocumentStatuses, listLegalVersions, type LegalDocumentAdminStatus } from "../../../../lib/legal";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, Badge, Notice } from "../../_ui/kit";
import { LegalEditor, type LegalVersionView } from "./legal-editor";
import { LegalMetaForm } from "./legal-meta-form";

/**
 * ADR-050 mục 3 + ADR-054 — editor văn bản pháp lý. Chọn văn bản bằng `?van-ban=<khoá>` (khoá không hợp lệ/không có →
 * văn bản đầu tiên, `terms`). Segment tĩnh `phap-ly` thắng `[slug]`. Wrapper <div>: layout admin đã có <main>.
 * Bộ chọn văn bản + khung "Mô tả & SEO" là bố cục tối thiểu — Phong hoàn thiện giao diện theo contract trong báo cáo.
 */

const STATUS_LABEL: Record<LegalDocumentAdminStatus, string> = {
  NONE: "Chưa có phiên bản",
  DRAFT_ONLY: "Chỉ có bản nháp",
  EFFECTIVE: "Đang hiệu lực",
  SCHEDULED: "Hẹn hiệu lực",
};
const STATUS_TONE: Record<LegalDocumentAdminStatus, "neutral" | "info" | "success" | "warning"> = {
  NONE: "neutral",
  DRAFT_ONLY: "info",
  EFFECTIVE: "success",
  SCHEDULED: "warning",
};

export default async function AdminLegalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminAccess("/admin/cms/phap-ly");
  const raw = (await searchParams)["van-ban"];
  const key: LegalDocumentKey = typeof raw === "string" && isLegalDocumentKey(raw) ? raw : LEGAL_DOCUMENT_KEYS[0]!;
  const [versions, statuses, meta] = await Promise.all([listLegalVersions(LEGAL_DOCUMENT_DEFS[key].key), listLegalDocumentStatuses(), getLegalDocumentMeta(key)]);
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
  const title = meta?.title ?? LEGAL_DOCUMENT_DEFS[key].title;

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={`Văn bản pháp lý — ${title}`}
        subtitle={`Trang công khai: ${legalDocumentPath(key)}. Mỗi lần thay đổi nội dung là một phiên bản mới; bản đã xuất bản không sửa được.`}
      />

      <nav aria-label="Chọn văn bản" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {LEGAL_DOCUMENT_KEYS.map((docKey) => {
            const status = statuses.get(docKey)?.status ?? "NONE";
            const current = docKey === key;
            return (
              <li key={docKey}>
                <Link
                  href={`/admin/cms/phap-ly?van-ban=${docKey}`}
                  aria-current={current ? "page" : undefined}
                  className="flex min-h-11 flex-col items-start gap-1 rounded-xl border px-3 py-2 text-sm outline-offset-2 hover:bg-gray-50 focus-visible:outline-2"
                  style={{ borderColor: current ? brandColors.accent : "#E5E7EB", background: current ? brandColors.accentSoft : "white", color: brandColors.ink }}
                >
                  <span className="font-semibold">{LEGAL_DOCUMENT_DEFS[docKey].title}</span>
                  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 space-y-3">
        <Notice tone="info">
          Chỉ xuất bản được khi đã tích “Đã rà soát pháp lý” và nội dung không còn dấu <code>[[CẦN XÁC NHẬN</code>. Dùng <code>{"{brand}"}</code> thay cho tên nền tảng.
          Bản đang hiệu lực = bản đã xuất bản mới nhất có ngày hiệu lực ≤ hiện tại. Văn bản chưa có bản hiệu lực: trang công khai trả 404 và link menu/footer tới văn bản tự ẩn.
        </Notice>
        {effective ? null : <Notice tone="warning">Chưa có bản đang hiệu lực — trang công khai trả 404, không ghi chấp thuận theo phiên bản cho văn bản này.</Notice>}
      </div>

      <LegalMetaForm
        key={key}
        documentKey={key}
        initial={{ summary: meta?.summary ?? "", seoTitle: meta?.seoTitle ?? "", seoDescription: meta?.seoDescription ?? "" }}
        defaultTitle={title}
      />
      <LegalEditor key={`editor-${key}`} documentKey={key} versions={views} />
    </div>
  );
}
