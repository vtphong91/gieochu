"use client";

import { useEffect, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconArrowUp } from "../admin/_ui/icons";

/**
 * Nút "Lên đầu trang" nổi góc phải dưới cho trang văn bản dài (`legal-document-page.tsx`) — chỉ dưới `lg` (từ `lg` mục
 * lục dính ở cột trái đã có link lên đầu). Hiện khi tiêu đề `#{targetId}` đã cuộn khỏi mép trên màn hình (IntersectionObserver,
 * không lắng nghe scroll). Đang ẩn → `invisible` (rời thứ tự Tab + cây a11y). Bấm là link anchor thường: không cần JS,
 * cuộn mượt chỉ khi người dùng không bật giảm chuyển động (globals.css). Không in.
 */
export function LegalBackToTop({ targetId }: { targetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <a
      href={`#${targetId}`}
      aria-label="Lên đầu trang"
      className={`no-print fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 inline-flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg outline-offset-2 transition-[opacity,visibility,transform] duration-200 [touch-action:manipulation] focus-visible:outline-2 motion-reduce:transition-none lg:hidden ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
      }`}
      style={{ background: brandColors.primary, outlineColor: brandColors.primary }}
    >
      <IconArrowUp className="h-5 w-5" />
    </a>
  );
}
