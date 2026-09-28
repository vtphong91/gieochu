"use client";

import { useState } from "react";
import type { StorefrontTestimonialsData } from "@gieochu/core/storefront-sections";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { IconChevronLeft, IconChevronRight } from "../../admin/_ui/icons";
import { IconQuote } from "./icons";
import { CONTAINER, SectionHeading, initialOf } from "./primitives";

type Item = StorefrontTestimonialsData["items"][number];

/** Kích thước (px) + độ lệch dọc (lg) của cụm avatar so le — vị trí giữa lớn nhất như mẫu. */
const AVATAR_LAYOUT = [
  { size: 64, shift: "lg:-translate-y-6" },
  { size: 52, shift: "lg:translate-y-8" },
  { size: 92, shift: "" },
  { size: 58, shift: "lg:-translate-y-8" },
  { size: 48, shift: "lg:translate-y-6" },
  { size: 54, shift: "lg:-translate-y-3" },
] as const;

/** Nền avatar chữ cái đầu — xoay vòng các màu có chữ trắng/chữ tối đã tính tương phản. */
const MONOGRAM_BG = [
  { bg: "var(--sf-primary)", fg: "var(--sf-on-primary)" },
  { bg: "var(--sf-accent)", fg: "var(--sf-on-accent)" },
  { bg: "var(--sf-red)", fg: "#ffffff" },
] as const;

/** Thứ tự hiển thị trong cụm: phần tử đầu (trích dẫn chính) ở giữa. */
function clusterOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (count < 3) return order;
  const [first, ...rest] = order;
  const half = Math.floor(rest.length / 2);
  return [...rest.slice(0, half), first!, ...rest.slice(half)];
}

function Avatar({ item, index, size }: { item: Item; index: number; size: number }) {
  if (item.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary do tenant upload
      <img src={cloudinaryDeliveryUrl(item.avatarUrl, { width: 200 })} alt="" width={size} height={size} loading="lazy" className="h-full w-full rounded-full object-cover" />
    );
  }
  const tone = MONOGRAM_BG[index % MONOGRAM_BG.length]!;
  return (
    <span
      aria-hidden="true"
      className="font-[family-name:var(--font-heading)] flex h-full w-full items-center justify-center rounded-full font-extrabold"
      style={{ background: tone.bg, color: tone.fg, fontSize: size * 0.4 }}
    >
      {initialOf(item.name)}
    </span>
  );
}

/**
 * Section "Cảm nhận" (ADR-029 mục 4 — nội dung tenant tự nhập, KHÔNG hiển thị sao để khỏi nhầm với đánh giá xác
 * thực của khách đã mua; trường `rating` cũ vẫn giữ trong dữ liệu). Trái trích dẫn + tên; phải cụm avatar tròn so le.
 * Nhiều đánh giá → avatar là nút chọn (aria-pressed) + nút trước/sau; KHÔNG tự
 * chạy (không autoplay), nội dung đổi được thông báo qua aria-live="polite".
 */
export function TestimonialsSection({ anchorId, data }: { anchorId: string; data: StorefrontTestimonialsData }) {
  const [active, setActive] = useState(0);
  const items = data.items;
  const current = items[Math.min(active, items.length - 1)];
  if (!current) return null;
  const many = items.length > 1;
  const titleId = `${anchorId}-title`;
  const go = (dir: -1 | 1) => setActive((i) => (i + dir + items.length) % items.length);

  return (
    <section id={anchorId} aria-labelledby={titleId} className="bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} />

        <div className="mt-12 grid items-center gap-10 rounded-xl bg-white px-6 py-9 shadow-[0_10px_36px_-14px_rgba(15,23,42,0.22)] ring-1 ring-black/[0.04] sm:px-10 md:grid-cols-[1.35fr_1fr] md:gap-6 lg:px-12 lg:py-11">
          <figure className="min-w-0" aria-live="polite">
            <IconQuote className="h-9 w-11 text-[color:var(--sf-red)]" />
            <blockquote className="mt-5 text-base leading-relaxed text-[color:var(--sf-ink)] italic sm:text-[17px]">
              <p className="whitespace-pre-line">{current.quote}</p>
            </blockquote>
            <figcaption className="mt-5 text-[15px]">
              <span aria-hidden="true">— </span>
              <span className="font-bold">{current.name}</span>
              {current.role ? <span style={{ color: "var(--sf-ink-soft)" }}>, {current.role}</span> : null}
            </figcaption>
            {many ? (
              <p className="sr-only">
                Cảm nhận {active + 1} trên {items.length}
              </p>
            ) : null}
          </figure>

          <div className="flex flex-col items-center gap-6">
            <ul className="flex flex-wrap items-center justify-center gap-3 lg:gap-4 lg:py-8" aria-label={many ? "Chọn cảm nhận" : undefined}>
              {clusterOrder(items.length).map((index) => {
                const item = items[index]!;
                const layout = AVATAR_LAYOUT[index % AVATAR_LAYOUT.length]!;
                const size = !many ? 96 : layout.size;
                const selected = index === active;
                const ring = selected ? "ring-4 ring-[color:var(--sf-accent)] ring-offset-2" : "ring-2 ring-white";
                return (
                  <li key={index} className={`shrink-0 ${many ? layout.shift : ""}`}>
                    {many ? (
                      <button
                        type="button"
                        onClick={() => setActive(index)}
                        aria-pressed={selected}
                        aria-label={`Xem cảm nhận của ${item.name}`}
                        className={`block cursor-pointer rounded-full shadow-md transition-transform duration-200 motion-safe:hover:scale-105 motion-reduce:transition-none ${ring}`}
                        style={{ width: Math.max(size, 48), height: Math.max(size, 48) }}
                      >
                        <Avatar item={item} index={index} size={size} />
                      </button>
                    ) : (
                      <span className={`block rounded-full shadow-md ${ring}`} style={{ width: size, height: size }}>
                        <Avatar item={item} index={index} size={size} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {many ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Cảm nhận trước"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white text-[color:var(--sf-ink)] transition-colors hover:bg-[color:var(--sf-primary-soft)]"
                  style={{ borderColor: "var(--sf-line)" }}
                >
                  <IconChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-12 text-center text-sm font-semibold tabular-nums" aria-hidden="true" style={{ color: "var(--sf-ink-soft)" }}>
                  {active + 1}/{items.length}
                </span>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Cảm nhận sau"
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white text-[color:var(--sf-ink)] transition-colors hover:bg-[color:var(--sf-primary-soft)]"
                  style={{ borderColor: "var(--sf-line)" }}
                >
                  <IconChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
