import { isLegalDocumentKey, LEGAL_DOCUMENT_DEFS, LEGAL_DOCUMENT_KEYS, type LegalDocumentKey } from "@gieochu/core";
import { getLegalEditorData, listLegalDocumentStatuses, type LegalDocumentAdminStatus } from "../../../../lib/legal";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader } from "../../_ui/kit";
import { LegalEditor, type LegalDocumentTab } from "./legal-editor";
import { LegalMetaForm } from "./legal-meta-form";

/**
 * ADR-050 mục 3 + ADR-054 + ADR-057 (bổ sung) — editor "Chính sách sử dụng". Chọn văn bản bằng `?van-ban=<khoá>` (khoá
 * không hợp lệ/không có → văn bản đầu tiên, `terms`). Segment tĩnh `phap-ly` thắng `[slug]`. Wrapper <div>: layout admin
 * đã có <main>. Mỗi văn bản MỘT nội dung (không lộ phiên bản) — dữ liệu từ `getLegalEditorData`.
 */

// Nhãn trạng thái ở hàng chọn văn bản (chữ + màu — không chỉ dựa màu).
const STATUS_LABEL: Record<LegalDocumentAdminStatus, string> = {
  NONE: "Chưa có nội dung",
  DRAFT_ONLY: "Nháp",
  EFFECTIVE: "Đã xuất bản",
  SCHEDULED: "Hẹn hiệu lực",
};
const STATUS_TONE: Record<LegalDocumentAdminStatus, LegalDocumentTab["statusTone"]> = {
  NONE: "neutral",
  DRAFT_ONLY: "info",
  EFFECTIVE: "success",
  SCHEDULED: "warning",
};

export default async function AdminLegalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminAccess("/admin/cms/phap-ly");
  const raw = (await searchParams)["van-ban"];
  const key: LegalDocumentKey = typeof raw === "string" && isLegalDocumentKey(raw) ? raw : LEGAL_DOCUMENT_KEYS[0]!;
  const [data, statuses] = await Promise.all([getLegalEditorData(key), listLegalDocumentStatuses()]);

  const documents: LegalDocumentTab[] = LEGAL_DOCUMENT_KEYS.map((docKey) => {
    const entry = statuses.get(docKey);
    const status = entry?.status ?? "NONE";
    const current = docKey === key;
    const isPublished = status === "EFFECTIVE" || status === "SCHEDULED";
    return {
      key: docKey,
      title: current ? data.title : LEGAL_DOCUMENT_DEFS[docKey].title,
      href: `/admin/cms/phap-ly?van-ban=${docKey}`,
      current,
      statusLabel: STATUS_LABEL[status],
      statusTone: STATUS_TONE[status],
      hasUnpublishedChanges: isPublished && (current ? data.hasUnpublishedChanges : (entry?.hasDraft ?? false)),
    };
  });

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={`Chính sách sử dụng — ${data.title}`}
        subtitle={`Soạn, xem trước và xuất bản các chính sách của nền tảng. Trang công khai: ${data.publicPath}.`}
      />
      <LegalEditor
        key={key}
        data={data}
        documents={documents}
        draftReleaseAvailable={data.draftReleaseAvailable}
        seo={
          <LegalMetaForm
            key={`meta-${key}`}
            documentKey={key}
            initial={{ summary: data.meta.summary, seoTitle: data.meta.seoTitle, seoDescription: data.meta.seoDescription }}
            defaultTitle={data.title}
          />
        }
      />
    </div>
  );
}
