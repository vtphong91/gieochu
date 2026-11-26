import { EmptyState, GhostLinkButton } from "../../_ui/kit";
import { IconChevronLeft, IconUsers } from "../../_ui/icons";

/**
 * 404 của `/admin/users/[userId]` (ADR-073): id sai định dạng hoặc người dùng không tồn tại. Đã qua `requireAdminAccess` nên chỉ
 * System Admin thấy màn này. Wrapper <div>: layout admin đã có <main>.
 */
export default function UserNotFound() {
  return (
    <div className="px-5 py-8 lg:px-8">
      <EmptyState
        icon={<IconUsers className="h-6 w-6" />}
        title="Không tìm thấy người dùng"
        description="Người dùng này không tồn tại hoặc đường dẫn không đúng. Hãy quay lại danh sách và chọn lại."
        action={
          <GhostLinkButton href="/admin/users">
            <IconChevronLeft className="h-4 w-4" /> Về danh sách người dùng
          </GhostLinkButton>
        }
      />
    </div>
  );
}
