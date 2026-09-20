"use client";

import Link from "next/link";

/**
 * Error boundary cho toàn bộ /admin — không có file này thì mọi Server Action
 * gọi requireRole("SYSTEM_ADMIN") (đúng thiết kế: Server Action ném AppError
 * thẳng, khác requireAdminAccess() ở Server Component tự redirect — xem
 * docs/PLAN.md mục M2) khi phiên đăng nhập hết hạn giữa chừng sẽ làm
 * Next.js hiện màn crash thô thay vì thông báo thân thiện. Next.js redact nội
 * dung `error.message` thật ở production (chỉ giữ `digest`), nên không suy
 * đoán nội dung lỗi — luôn hiện cùng 1 thông báo an toàn, kèm lối thoát rõ
 * ràng (đăng nhập lại / thử lại).
 */
export default function AdminErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="font-[family-name:var(--font-heading)] text-xl font-bold" style={{ color: "#12213A" }}>
        Có lỗi xảy ra
      </p>
      <p className="max-w-md text-sm text-gray-500">
        Có thể phiên đăng nhập của anh đã hết hạn, hoặc có lỗi tạm thời. Thử tải lại hoặc đăng nhập lại.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          style={{ borderColor: "#E5E7EB", color: "#12213A" }}
        >
          Thử lại
        </button>
        <Link
          href="/login?next=/admin"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          style={{ background: "#0F3B82" }}
        >
          Đăng nhập lại
        </Link>
      </div>
    </main>
  );
}
