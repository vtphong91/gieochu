import { PLAN_FEATURE_LABELS } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getPricingCmsEditorData } from "../../../../lib/pricing-cms";
import { AdminPageHeader, Notice } from "../../_ui/kit";
import { PricingSectionsEditor } from "./_ui/pricing-sections-editor";

/**
 * ADR-041 A — editor CMS Bảng giá (GĐ2: form theo pattern editor Cửa hàng). Segment tĩnh `pricing` thắng `[slug]`. Giá/hạn
 * mức/cờ chỉ đọc từ `Plan` (sửa ở `/admin/plans`). Wrapper <div>: layout admin đã có <main>.
 */
export default async function AdminPricingCmsPage() {
  await requireAdminAccess("/admin/cms/pricing");
  const data = await getPricingCmsEditorData();

  // Định dạng ở server (múi giờ hiển thị cố định) — tránh lệch giờ giữa server/trình duyệt khi hydrate.
  const updatedAtLabel = data.updatedAt
    ? data.updatedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const unimplemented = Object.entries(PLAN_FEATURE_LABELS)
    .filter(([key]) => !data.implementedFeatures.includes(key as keyof typeof PLAN_FEATURE_LABELS))
    .map(([, label]) => label);

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Trang Bảng giá"
        subtitle="Chỉnh nội dung, thứ tự và cấu hình các khu vực của trang Bảng giá. Tên, giá, chu kỳ và hạn mức gói lấy từ Gói dịch vụ — không nhập ở đây. Lưu nháp, xem trước, rồi Xuất bản khi sẵn sàng."
      />

      <div className="mt-6 space-y-3">
        <Notice tone="info">
          Biến dùng được trong chữ: <code>{"{brand}"}</code> (tên nền tảng), <code>{"{graceDays}"}</code> (số ngày ân hạn, hiện là {data.graceDays}); nhãn nút gói dùng
          thêm <code>{"{plan}"}</code> (tên gói). % tiết kiệm của gói ghép cặp tính tự động từ giá thật.
        </Notice>
        {unimplemented.length > 0 ? (
          <Notice tone="warning">
            Chỉ quảng cáo tính năng có thật: các cờ chưa được hệ thống chặn theo gói ({unimplemented.join(", ")}) không chọn được trong bảng so sánh và không hiện trên
            trang. Quyền lợi gõ tay trên thẻ gói cũng không nên nhắc tới các tính năng này.
          </Notice>
        ) : null}
      </div>

      <PricingSectionsEditor
        initialSections={data.sections}
        live={data.live}
        initialHasDraft={data.hasDraft}
        initialStatus={data.status}
        updatedAtLabel={updatedAtLabel}
        initialSeo={{ seoTitle: data.seoTitle, seoDescription: data.seoDescription }}
        ctx={{
          plans: data.plans,
          stats: data.stats,
          enabledProviders: data.enabledProviders,
          implementedFeatures: data.implementedFeatures,
          graceDays: data.graceDays,
        }}
      />
    </div>
  );
}
