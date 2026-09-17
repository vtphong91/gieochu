import { requireCompleteAccountAccess } from "../../../lib/page-guards";

// Full implementation (entitlements grouped by tenant, download buttons) lands
// in M9 — Thư viện, Tải xuống và Link chia sẻ private. For now this page only
// exists to carry the profile-completion gate (§"M1" flowchart + integration
// test "Chưa hoàn thiện hồ sơ bị chuyển hướng khỏi /account/library").
export default async function LibraryPage() {
  await requireCompleteAccountAccess("/account/library");

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">Thư viện của bạn</h1>
      <p className="mt-4 text-gray-600">Danh sách tài liệu đã mua sẽ hiển thị tại đây (đang xây dựng).</p>
    </main>
  );
}
