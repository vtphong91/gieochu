"use client";

import { AdminPageHeader } from "../../admin/_ui/kit";

/** Lỗi khi tải Thư viện — thông điệp tiếng Việt + nút thử lại (không lộ chi tiết lỗi kỹ thuật). */
export default function LibraryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div>
      <AdminPageHeader title="Thư viện của bạn" />
      {/* Thông báo lỗi là đoạn văn — giới hạn độ dài dòng (không giới hạn khung trang). */}
      <div role="alert" className="mt-6 max-w-3xl rounded-xl border border-l-4 p-4 text-sm leading-relaxed" style={{ borderColor: "#B91C1C", background: "#FEF2F2" }}>
        <p className="font-semibold">Không tải được thư viện.</p>
        <p className="mt-1">Đã có lỗi khi đọc danh sách tài liệu của bạn. Vui lòng thử lại sau ít phút.</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-full border px-5 text-sm font-semibold text-[var(--color-primary)] hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
      >
        Thử lại
      </button>
    </div>
  );
}
