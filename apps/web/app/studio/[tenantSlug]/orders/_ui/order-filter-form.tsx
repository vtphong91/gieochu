"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * ADR-046 — form lọc GET của danh sách đơn. Không JS: `<form method="get">` gửi như thường (loader parse phòng thủ).
 * Có JS: chặn submit, bỏ ô rỗng và giá trị mặc định (`defaults`, vd `sap-xep=moi-nhat`, `so-dong=20`) rồi `router.push`
 * → URL gọn, chia sẻ được; đổi bộ lọc luôn về trang 1 (form không có ô `trang`).
 */
export function OrderFilterForm({
  action,
  defaults,
  label = "Lọc đơn hàng",
  className,
  style,
  children,
}: {
  action: string;
  /** Tên tham số → giá trị mặc định (bỏ khỏi URL khi trùng). */
  defaults: Record<string, string>;
  /** Tên vùng tìm kiếm cho trình đọc màn hình (trang Khách hàng ADR-048 dùng lại form này). */
  label?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, raw] of new FormData(event.currentTarget)) {
      if (typeof raw !== "string") continue;
      const value = key === "q" ? raw.trim() : raw;
      if (value === "" || defaults[key] === value || params.has(key)) continue;
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  return (
    <form method="get" action={action} role="search" aria-label={label} onSubmit={onSubmit} className={className} style={style}>
      {children}
    </form>
  );
}
