import { EmptyState, GhostLinkButton } from "../../_ui/kit";
import { IconChevronLeft, IconLayers } from "../../_ui/icons";

/**
 * 404 của `/admin/tenants/[tenantId]` (ADR-072): id sai định dạng hoặc gian hàng không tồn tại. Đã qua `requireAdminAccess` nên
 * chỉ System Admin thấy màn này. Wrapper <div>: layout admin đã có <main>.
 */
export default function TenantNotFound() {
  return (
    <div className="px-5 py-8 lg:px-8">
      <EmptyState
        icon={<IconLayers className="h-6 w-6" />}
        title="Không tìm thấy gian hàng"
        description="Gian hàng này không tồn tại hoặc đường dẫn không đúng. Hãy quay lại danh sách và chọn lại."
        action={
          <GhostLinkButton href="/admin/tenants">
            <IconChevronLeft className="h-4 w-4" /> Về danh sách gian hàng
          </GhostLinkButton>
        }
      />
    </div>
  );
}
