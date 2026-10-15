import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { getShopCmsEditorData } from "../../../../lib/shop-cms";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader } from "../../_ui/kit";
import { toCategoryPinOption, toProductPinOption, toTenantPinOption } from "../home-editor/pin-options";
import { ShopSectionsEditor } from "./_ui/shop-sections-editor";

/**
 * ADR-035 GĐ1 — editor CMS Cửa hàng. Segment tĩnh `shop` thắng `[slug]`, nên xử lý được cả khi chưa có dòng
 * `CmsPage` slug `shop` (loader trả mặc định). Editor (`./_ui/shop-sections-editor.tsx`) nối với `./actions.ts`.
 * Wrapper là <div>: layout admin đã có <main>.
 */
export default async function AdminShopCmsPage() {
  await requireAdminAccess("/admin/cms/shop");
  const data = await getShopCmsEditorData();

  // Định dạng ở server (múi giờ hiển thị cố định) — tránh lệch giờ giữa server/trình duyệt khi hydrate.
  const updatedAtLabel = data.updatedAt
    ? data.updatedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Trang Cửa hàng"
        subtitle="Chỉnh nội dung, thứ tự và cấu hình các khu vực của trang Cửa hàng. Lưu nháp trước, Xuất bản khi sẵn sàng — tài liệu, gian hàng và số liệu luôn lấy từ dữ liệu thật."
      />
      <ShopSectionsEditor
        initialSections={data.sections}
        live={data.live}
        initialHasDraft={data.hasDraft}
        initialStatus={data.status}
        updatedAtLabel={updatedAtLabel}
        pinOptions={{
          tenants: data.pinOptions.tenants.map(toTenantPinOption),
          products: data.pinOptions.products.map(toProductPinOption),
          categories: data.pinOptions.categories.map(toCategoryPinOption),
        }}
      />
    </div>
  );
}
