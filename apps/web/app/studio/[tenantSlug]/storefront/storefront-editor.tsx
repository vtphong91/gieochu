"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
// Subpath (không qua barrel "@gieochu/core") — barrel kéo theo code server-only (argon2, pino).
import {
  STOREFRONT_PRODUCTS_LIMIT_MAX,
  STOREFRONT_PRODUCTS_LIMIT_MIN,
  STOREFRONT_POSTS_LIMIT_MAX,
  STOREFRONT_POSTS_LIMIT_MIN,
  STOREFRONT_REVIEWS_LIMIT_MAX,
  STOREFRONT_REVIEWS_LIMIT_MIN,
  STOREFRONT_REVIEWS_PINNED_MAX,
  STOREFRONT_SECTION_LABELS,
  STOREFRONT_SERVICE_ICON_LABELS,
  STOREFRONT_SERVICE_ICONS,
  type StorefrontCta,
  type StorefrontSection,
  type StorefrontServiceIcon,
} from "@gieochu/core/storefront-sections";
import { Badge, GhostButton, PrimaryButton, SelectField, TextField } from "../../../admin/_ui/kit";
import { IconCheckCircle, IconChevronDown, IconExternalLink, IconEye, IconEyeOff, IconPlus, IconTrash } from "../../../admin/_ui/icons";
import { ImageUploadField } from "../../../admin/_ui/image-upload-field";
import type { CloudinarySignatureResult } from "../../../_ui/cloudinary-actions";
import {
  getTenantCloudinaryUploadSignatureAction,
  publishStorefrontAction,
  restoreLiveStorefrontAction,
  saveStorefrontDraftAction,
} from "./actions";
import { registerTenantImageAction, type RegisterTenantImageResult } from "../media-actions";

const INK = "#12213A";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const RED = "#DC2626";
/** Nút icon nhỏ (lên/xuống/xoá/ẩn-hiện): 44px trên mobile, 32px từ lg — luôn có aria-label. */
const ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent lg:h-8 lg:w-8";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TEXTAREA_CLASS =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

interface UploadImageProps {
  getSignature: () => Promise<CloudinarySignatureResult>;
  register: (publicId: string) => Promise<RegisterTenantImageResult>;
  maxBytes: number;
  accept: string;
}

export interface ProductOption {
  id: string;
  title: string;
}

/** ADR-029: đánh giá VISIBLE có thể ghim lên section "Đánh giá" (từ `listStorefrontReviewOptions`, rút gọn ở page). */
export interface ReviewPinOption {
  id: string;
  rating: number;
  displayName: string;
  /** Trích nội dung ≤ 80 ký tự; null = chỉ chấm sao. */
  excerpt: string | null;
  productTitle: string;
}

function reviewOptionLabel(option: ReviewPinOption): string {
  return `${option.rating} sao · ${option.displayName} · ${option.productTitle}${option.excerpt ? ` — “${option.excerpt}”` : ""}`;
}

type Data<T extends StorefrontSection["type"]> = Extract<StorefrontSection, { type: T }>["data"];

function TextArea({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={TEXTAREA_CLASS} style={{ borderColor: LINE }} />
    </div>
  );
}

function CtaEditor({ id, label, value, onChange }: { id: string; label: string; value: StorefrontCta; onChange: (v: StorefrontCta) => void }) {
  return (
    <div className="rounded-lg border p-3.5" style={{ borderColor: LINE }}>
      <p className="mb-2.5 text-sm font-medium" style={{ color: INK }}>
        {label}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField id={`${id}-label`} label="Chữ trên nút" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        <TextField
          id={`${id}-href`}
          label="Liên kết"
          hint="#tai-lieu, /duong-dan hoặc https://..."
          value={value.href}
          onChange={(e) => onChange({ ...value, href: e.target.value })}
        />
      </div>
    </div>
  );
}

function ItemCard({ index, onRemove, children }: { index: number; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-gray-50/60 p-4" style={{ borderColor: LINE }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
          Mục {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-red-50 lg:min-h-8"
          style={{ color: RED }}
        >
          <IconTrash className="h-3.5 w-3.5" /> Xoá mục {index + 1}
        </button>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function SectionFields({
  section,
  onChange,
  products,
  reviewOptions,
  tenantSlug,
  uploadImage,
}: {
  section: StorefrontSection;
  onChange: (data: StorefrontSection["data"]) => void;
  products: ProductOption[];
  reviewOptions: ReviewPinOption[];
  tenantSlug: string;
  uploadImage: UploadImageProps;
}) {
  switch (section.type) {
    case "hero": {
      const d = section.data;
      const set = (patch: Partial<Data<"hero">>) => onChange({ ...d, ...patch });
      return (
        <div className="space-y-4">
          <TextField id="hero-eyebrow" label="Dòng nhỏ trên tiêu đề (tuỳ chọn)" value={d.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
          <TextField id="hero-title" label="Tiêu đề" value={d.title} onChange={(e) => set({ title: e.target.value })} />
          <TextField id="hero-highlight" label="Dòng nhấn mạnh (tuỳ chọn)" value={d.highlight ?? ""} onChange={(e) => set({ highlight: e.target.value })} />
          <TextArea id="hero-subtitle" label="Đoạn giới thiệu" value={d.subtitle} onChange={(v) => set({ subtitle: v })} />
          <CtaEditor id="hero-primary" label="Nút chính" value={d.primaryCta} onChange={(v) => set({ primaryCta: v })} />
          <CtaEditor id="hero-secondary" label="Nút phụ" value={d.secondaryCta} onChange={(v) => set({ secondaryCta: v })} />
          <ImageUploadField label="Ảnh (tuỳ chọn, tối đa 2MB)" value={d.imageUrl ?? ""} onChange={(url) => set({ imageUrl: url })} {...uploadImage} />
        </div>
      );
    }
    case "services": {
      const d = section.data;
      const setItem = (index: number, patch: Partial<Data<"services">["items"][number]>) =>
        onChange({ ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-4">
          <TextField id="services-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextArea id="services-subtitle" label="Mô tả (tuỳ chọn)" value={d.subtitle ?? ""} onChange={(v) => onChange({ ...d, subtitle: v })} rows={2} />
          <p className="text-sm font-medium" style={{ color: INK }}>
            Các mục ({d.items.length}/6)
          </p>
          {d.items.map((item, index) => (
            <ItemCard key={index} index={index} onRemove={() => onChange({ ...d, items: d.items.filter((_, i) => i !== index) })}>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <SelectField id={`svc-${index}-icon`} label="Biểu tượng" value={item.icon} onChange={(e) => setItem(index, { icon: e.target.value as StorefrontServiceIcon })}>
                  {STOREFRONT_SERVICE_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {STOREFRONT_SERVICE_ICON_LABELS[icon]}
                    </option>
                  ))}
                </SelectField>
                <TextField id={`svc-${index}-title`} label="Tiêu đề" value={item.title} onChange={(e) => setItem(index, { title: e.target.value })} />
              </div>
              <TextArea id={`svc-${index}-desc`} label="Mô tả" value={item.description} onChange={(v) => setItem(index, { description: v })} rows={2} />
              <ImageUploadField label="Ảnh (tuỳ chọn)" value={item.imageUrl ?? ""} onChange={(url) => setItem(index, { imageUrl: url })} {...uploadImage} />
            </ItemCard>
          ))}
          <GhostButton disabled={d.items.length >= 6} onClick={() => onChange({ ...d, items: [...d.items, { icon: "book", title: "", description: "" }] })}>
            <IconPlus className="h-4 w-4" /> Thêm mục
          </GhostButton>
        </div>
      );
    }
    case "products": {
      const d = section.data;
      const available = products.filter((p) => !d.featuredProductIds.includes(p.id));
      const titleOf = (id: string) => products.find((p) => p.id === id)?.title ?? "(Sản phẩm không còn đăng bán — sẽ bị bỏ qua)";
      const moveFeatured = (index: number, dir: -1 | 1) => {
        const next = [...d.featuredProductIds];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        onChange({ ...d, featuredProductIds: next });
      };
      return (
        <div className="space-y-4">
          <TextField id="products-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextArea id="products-subtitle" label="Mô tả (tuỳ chọn)" value={d.subtitle ?? ""} onChange={(v) => onChange({ ...d, subtitle: v })} rows={2} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              id="products-limit"
              type="number"
              min={STOREFRONT_PRODUCTS_LIMIT_MIN}
              max={STOREFRONT_PRODUCTS_LIMIT_MAX}
              label={`Số tài liệu hiển thị (${STOREFRONT_PRODUCTS_LIMIT_MIN}–${STOREFRONT_PRODUCTS_LIMIT_MAX})`}
              value={d.limit}
              onChange={(e) => onChange({ ...d, limit: Number.parseInt(e.target.value, 10) || STOREFRONT_PRODUCTS_LIMIT_MIN })}
            />
            <TextField id="products-cta" label="Chữ trên nút xem thêm (tuỳ chọn)" value={d.ctaLabel ?? ""} onChange={(e) => onChange({ ...d, ctaLabel: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: INK }}>
              Tài liệu nổi bật (hiện trước, theo thứ tự) — phần còn lại tự lấy tài liệu mới nhất
            </p>
            <ol className="mt-2 space-y-1.5">
              {d.featuredProductIds.map((id, index) => (
                <li key={id} className="flex items-center gap-1 rounded-lg border py-1 pr-1 pl-3 text-sm" style={{ borderColor: LINE }}>
                  <span className="w-5 shrink-0 text-xs font-semibold tabular-nums" style={{ color: INK_SOFT }}>
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={titleOf(id)}>
                    {titleOf(id)}
                  </span>
                  <button type="button" disabled={index === 0} onClick={() => moveFeatured(index, -1)} aria-label={`Đưa "${titleOf(id)}" lên`} className={ICON_BTN}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    disabled={index === d.featuredProductIds.length - 1}
                    onClick={() => moveFeatured(index, 1)}
                    aria-label={`Đưa "${titleOf(id)}" xuống`}
                    className={ICON_BTN}
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...d, featuredProductIds: d.featuredProductIds.filter((x) => x !== id) })}
                    aria-label={`Bỏ "${titleOf(id)}" khỏi nổi bật`}
                    className={`${ICON_BTN} hover:bg-red-50`}
                    style={{ color: RED }}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
            {products.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed px-3 py-2.5 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
                Chưa có tài liệu nào đang đăng bán — khách sẽ thấy thông báo &quot;Chưa có tài liệu&quot; ở phần này.
              </p>
            ) : (
              <div className="mt-2.5">
                <SelectField
                  id="products-add-featured"
                  label="Thêm tài liệu nổi bật"
                  value=""
                  disabled={available.length === 0 || d.featuredProductIds.length >= STOREFRONT_PRODUCTS_LIMIT_MAX}
                  onChange={(e) => {
                    if (e.target.value) onChange({ ...d, featuredProductIds: [...d.featuredProductIds, e.target.value] });
                  }}
                >
                  <option value="">— Chọn tài liệu —</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "testimonials": {
      const d = section.data;
      const setItem = (index: number, patch: Partial<Data<"testimonials">["items"][number]>) =>
        onChange({ ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
      return (
        <div className="space-y-4">
          <TextField id="testimonials-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <p className="rounded-lg border px-3.5 py-2.5 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
            Lời cảm nhận do bạn tự nhập — không hiển thị sao. Đánh giá có sao của khách đã mua nằm ở phần <strong>Đánh giá</strong>.
          </p>
          <p className="text-sm font-medium" style={{ color: INK }}>
            Cảm nhận ({d.items.length}/6) — chỉ đăng lời thật từ học viên/khách hàng của bạn
          </p>
          {d.items.map((item, index) => (
            <ItemCard key={index} index={index} onRemove={() => onChange({ ...d, items: d.items.filter((_, i) => i !== index) })}>
              <TextArea id={`t-${index}-quote`} label="Nội dung" value={item.quote} onChange={(v) => setItem(index, { quote: v })} rows={2} />
              {/* ADR-029: "Cảm nhận" không có sao — trường `rating` cũ giữ nguyên trong dữ liệu, không còn ô sửa. */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TextField id={`t-${index}-name`} label="Tên" value={item.name} onChange={(e) => setItem(index, { name: e.target.value })} />
                <TextField id={`t-${index}-role`} label="Vai trò (tuỳ chọn)" value={item.role ?? ""} onChange={(e) => setItem(index, { role: e.target.value })} />
              </div>
              <ImageUploadField label="Ảnh đại diện (tuỳ chọn)" value={item.avatarUrl ?? ""} onChange={(url) => setItem(index, { avatarUrl: url })} {...uploadImage} />
            </ItemCard>
          ))}
          <GhostButton disabled={d.items.length >= 6} onClick={() => onChange({ ...d, items: [...d.items, { quote: "", name: "", rating: 5 }] })}>
            <IconPlus className="h-4 w-4" /> Thêm cảm nhận
          </GhostButton>
        </div>
      );
    }
    case "reviews": {
      const d = section.data;
      const available = reviewOptions.filter((o) => !d.pinnedReviewIds.includes(o.id));
      const labelOf = (id: string) => {
        const option = reviewOptions.find((o) => o.id === id);
        return option ? reviewOptionLabel(option) : "(Đánh giá đã bị ẩn/xoá hoặc tài liệu ngừng bán — sẽ bị bỏ qua)";
      };
      const movePinned = (index: number, dir: -1 | 1) => {
        const next = [...d.pinnedReviewIds];
        const target = index + dir;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target]!, next[index]!];
        onChange({ ...d, pinnedReviewIds: next });
      };
      const pinnedFull = d.pinnedReviewIds.length >= STOREFRONT_REVIEWS_PINNED_MAX;
      return (
        <div className="space-y-4">
          <p className="rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed" style={{ borderColor: LINE, color: INK_SOFT }}>
            Hiển thị đánh giá <strong>thật</strong> của khách đã mua (có nhãn “Đã mua”). Bạn không sửa được nội dung đánh giá; đánh giá đã ẩn không bao giờ
            hiện. Chưa có đánh giá phù hợp thì phần này tự ẩn khỏi trang.{" "}
            <Link href={`/studio/${tenantSlug}/reviews`} className="font-semibold underline underline-offset-2 hover:no-underline" style={{ color: INK }}>
              Quản lý đánh giá
            </Link>
          </p>
          <TextField id="reviews-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <TextField
              id="reviews-limit"
              type="number"
              min={STOREFRONT_REVIEWS_LIMIT_MIN}
              max={STOREFRONT_REVIEWS_LIMIT_MAX}
              label={`Số đánh giá hiển thị (${STOREFRONT_REVIEWS_LIMIT_MIN}–${STOREFRONT_REVIEWS_LIMIT_MAX})`}
              value={d.limit}
              onChange={(e) => onChange({ ...d, limit: Number.parseInt(e.target.value, 10) || STOREFRONT_REVIEWS_LIMIT_MIN })}
            />
            <SelectField
              id="reviews-min-rating"
              label="Tự động lấy đánh giá từ"
              value={d.minRating}
              onChange={(e) => onChange({ ...d, minRating: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 sao (mọi đánh giá)" : n === 5 ? "5 sao" : `${n} sao trở lên`}
                </option>
              ))}
            </SelectField>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium" style={{ color: INK, borderColor: LINE }}>
            <input
              type="checkbox"
              checked={d.requireBody}
              onChange={(e) => onChange({ ...d, requireBody: e.target.checked })}
              className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0F3B82]"
            />
            Chỉ tự động lấy đánh giá có viết nhận xét (bỏ qua đánh giá chỉ chấm sao)
          </label>

          <div>
            <p className="text-sm font-medium" style={{ color: INK }}>
              Đánh giá ghim ({d.pinnedReviewIds.length}/{STOREFRONT_REVIEWS_PINNED_MAX})
            </p>
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
              Chưa ghim = tự lấy đánh giá mới nhất theo điều kiện trên. Có ghim = chỉ hiện các đánh giá được ghim, đúng thứ tự dưới đây (không áp số sao
              tối thiểu và điều kiện nhận xét).
            </p>
            {d.pinnedReviewIds.length > d.limit ? (
              <p className="mt-2 rounded-lg border px-3 py-2 text-xs" style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
                Chỉ {d.limit} đánh giá ghim đầu tiên được hiện — tăng “Số đánh giá hiển thị” hoặc bớt ghim.
              </p>
            ) : null}
            <ol className="mt-2 space-y-1.5">
              {d.pinnedReviewIds.map((id, index) => (
                <li key={id} className="flex items-center gap-1 rounded-lg border py-1 pr-1 pl-3 text-sm" style={{ borderColor: LINE }}>
                  <span className="w-5 shrink-0 text-xs font-semibold tabular-nums" style={{ color: INK_SOFT }}>
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={labelOf(id)}>
                    {labelOf(id)}
                  </span>
                  <button type="button" disabled={index === 0} onClick={() => movePinned(index, -1)} aria-label={`Đưa đánh giá ghim số ${index + 1} lên`} className={ICON_BTN}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    disabled={index === d.pinnedReviewIds.length - 1}
                    onClick={() => movePinned(index, 1)}
                    aria-label={`Đưa đánh giá ghim số ${index + 1} xuống`}
                    className={ICON_BTN}
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...d, pinnedReviewIds: d.pinnedReviewIds.filter((x) => x !== id) })}
                    aria-label={`Bỏ ghim đánh giá số ${index + 1}`}
                    className={`${ICON_BTN} hover:bg-red-50`}
                    style={{ color: RED }}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ol>
            {reviewOptions.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed px-3 py-2.5 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
                Chưa có đánh giá công khai nào để ghim. Khi khách đã mua viết đánh giá, bạn sẽ chọn được ở đây.
              </p>
            ) : (
              <div className="mt-2.5">
                <SelectField
                  id="reviews-add-pinned"
                  label="Ghim thêm đánh giá"
                  hint={pinnedFull ? `Đã đủ ${STOREFRONT_REVIEWS_PINNED_MAX} đánh giá ghim.` : "Danh sách gồm tối đa 200 đánh giá công khai mới nhất."}
                  value=""
                  disabled={available.length === 0 || pinnedFull}
                  onChange={(e) => {
                    if (e.target.value) onChange({ ...d, pinnedReviewIds: [...d.pinnedReviewIds, e.target.value] });
                  }}
                >
                  <option value="">— Chọn đánh giá —</option>
                  {available.map((o) => (
                    <option key={o.id} value={o.id}>
                      {reviewOptionLabel(o)}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}
          </div>
        </div>
      );
    }
    case "posts": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <p className="rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed" style={{ borderColor: LINE, color: INK_SOFT }}>
            Hiển thị các bài <strong>đã đăng</strong> mới nhất, kèm nút “Xem tất cả bài viết” dẫn tới trang Bài viết của bạn. Chưa có bài nào đã đăng thì
            phần này tự ẩn khỏi trang.{" "}
            <Link href={`/studio/${tenantSlug}/posts`} className="font-semibold underline underline-offset-2 hover:no-underline" style={{ color: INK }}>
              Quản lý bài viết
            </Link>
          </p>
          <TextField id="posts-title" label="Tiêu đề" maxLength={120} value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField
            id="posts-limit"
            type="number"
            inputMode="numeric"
            min={STOREFRONT_POSTS_LIMIT_MIN}
            max={STOREFRONT_POSTS_LIMIT_MAX}
            step={1}
            label={`Số bài hiển thị (${STOREFRONT_POSTS_LIMIT_MIN}–${STOREFRONT_POSTS_LIMIT_MAX})`}
            hint="Mỗi hàng 3 bài trên máy tính — chọn 3, 6 hoặc 9 để lưới đều."
            value={d.limit}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              onChange({ ...d, limit: Number.isFinite(n) ? Math.min(Math.max(n, STOREFRONT_POSTS_LIMIT_MIN), STOREFRONT_POSTS_LIMIT_MAX) : STOREFRONT_POSTS_LIMIT_MIN });
            }}
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium" style={{ color: INK, borderColor: LINE }}>
            <input
              type="checkbox"
              checked={d.showPinnedFirst}
              onChange={(e) => onChange({ ...d, showPinnedFirst: e.target.checked })}
              className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0F3B82]"
            />
            Đưa bài đang ghim lên đầu (nếu có)
          </label>
        </div>
      );
    }
    case "contact": {
      const d = section.data;
      const set = (patch: Partial<Data<"contact">>) => onChange({ ...d, ...patch });
      return (
        <div className="space-y-4">
          <TextField id="contact-title" label="Tiêu đề" value={d.title} onChange={(e) => set({ title: e.target.value })} />
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium" style={{ color: INK, borderColor: LINE }}>
            <input type="checkbox" checked={d.formEnabled} onChange={(e) => set({ formEnabled: e.target.checked })} className="h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0F3B82]" />
            Bật form nhận lời nhắn (tin nhắn vào mục Hộp thư + email báo cho bạn)
          </label>
          {d.formEnabled ? (
            <>
              <TextField id="contact-form-title" label="Tiêu đề form (tuỳ chọn)" value={d.formTitle ?? ""} onChange={(e) => set({ formTitle: e.target.value })} />
              <TextArea id="contact-success" label="Thông báo sau khi gửi thành công" value={d.successMessage} onChange={(v) => set({ successMessage: v })} rows={2} />
            </>
          ) : null}
          <div className="rounded-lg border p-3.5" style={{ borderColor: LINE }}>
            <p className="mb-2.5 text-sm font-medium" style={{ color: INK }}>
              Khối kêu gọi hành động
            </p>
            <div className="space-y-2.5">
              <TextField id="contact-cta-title" label="Tiêu đề" value={d.ctaTitle} onChange={(e) => set({ ctaTitle: e.target.value })} />
              <TextArea id="contact-cta-subtitle" label="Mô tả" value={d.ctaSubtitle} onChange={(v) => set({ ctaSubtitle: v })} rows={2} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TextField id="contact-cta-label" label="Chữ trên nút" value={d.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} />
                <TextField
                  id="contact-cta-href"
                  label="Liên kết (tuỳ chọn)"
                  hint="Để trống = dùng link mạng xã hội trong Cài đặt"
                  value={d.ctaHref ?? ""}
                  onChange={(e) => set({ ctaHref: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}

type PendingAction = "save" | "publish" | "restore";

export function StorefrontEditor({
  tenantSlug,
  initialSections,
  live,
  defaults,
  hasDraft: initialHasDraft,
  products,
  reviewOptions,
  cloudinaryReady,
}: {
  tenantSlug: string;
  initialSections: StorefrontSection[];
  /** Bản live đã xuất bản; null = chưa từng xuất bản. */
  live: StorefrontSection[] | null;
  /** Nội dung mẫu — dùng khi "khôi phục" lúc chưa có bản live. */
  defaults: StorefrontSection[];
  hasDraft: boolean;
  products: ProductOption[];
  reviewOptions: ReviewPinOption[];
  cloudinaryReady: boolean;
}) {
  const [sections, setSections] = useState<StorefrontSection[]>(initialSections);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [isPublished, setIsPublished] = useState(live !== null);
  const [liveSections, setLiveSections] = useState(live);
  const [selectedId, setSelectedId] = useState<string>(initialSections[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Chỉ phục vụ hiển thị "Có thay đổi chưa lưu" + cảnh báo rời trang — không ảnh hưởng dữ liệu gửi đi.
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSections));
  const isDirty = JSON.stringify(sections) !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const uploadImage: UploadImageProps = {
    getSignature: () => getTenantCloudinaryUploadSignatureAction(tenantSlug),
    register: (publicId: string) => registerTenantImageAction(tenantSlug, publicId, "STOREFRONT"),
    maxBytes: MAX_IMAGE_BYTES,
    accept: "image/png,image/jpeg,image/webp",
  };

  function updateSelectedData(data: StorefrontSection["data"]) {
    setSections((prev) => prev.map((s) => (s.id === selected?.id ? ({ ...s, data } as StorefrontSection) : s)));
  }

  function toggleVisible(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  }

  function move(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  function saveDraft() {
    const snapshot = JSON.stringify(sections);
    setPendingAction("save");
    startTransition(async () => {
      const result = await saveStorefrontDraftAction(tenantSlug, sections);
      if (result.success) {
        setHasDraft(true);
        setSavedSnapshot(snapshot);
      }
      setMessage(result.success ? { ok: true, text: "Đã lưu bản nháp — trang công khai chưa thay đổi." } : { ok: false, text: result.error ?? "Lưu thất bại." });
    });
  }

  function publish() {
    const snapshot = JSON.stringify(sections);
    setPendingAction("publish");
    startTransition(async () => {
      const result = await publishStorefrontAction(tenantSlug, sections);
      if (result.success) {
        setHasDraft(false);
        setIsPublished(true);
        setLiveSections(sections);
        setSavedSnapshot(snapshot);
      }
      setMessage(result.success ? { ok: true, text: "Đã xuất bản — trang bán hàng đã cập nhật." } : { ok: false, text: result.error ?? "Xuất bản thất bại." });
    });
  }

  function restoreLive() {
    const target = liveSections ? "bản đang hiển thị" : "nội dung mẫu";
    if (!window.confirm(`Bỏ bản nháp và mọi thay đổi chưa xuất bản, quay về ${target}?`)) return;
    setPendingAction("restore");
    startTransition(async () => {
      const result = await restoreLiveStorefrontAction(tenantSlug);
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Khôi phục thất bại." });
        return;
      }
      const restored = liveSections ?? defaults;
      setSections(restored);
      setSelectedId(restored[0]?.id ?? "");
      setHasDraft(false);
      setSavedSnapshot(JSON.stringify(restored));
      setMessage({ ok: true, text: liveSections ? "Đã khôi phục về bản đang hiển thị." : "Đã khôi phục về nội dung mẫu." });
    });
  }

  const busy = (action: PendingAction) => isPending && pendingAction === action;
  const visibleCount = sections.filter((s) => s.visible).length;

  return (
    <div className="mt-6 space-y-4">
      {!isPublished ? (
        <p className="rounded-xl border px-4 py-3 text-sm" style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}>
          Trang của bạn đang hiển thị <strong>nội dung mẫu</strong> (khách không thấy phần cảm nhận mẫu). Chỉnh sửa rồi bấm <strong>Xuất bản</strong> để dùng nội dung của bạn.
        </p>
      ) : null}
      {!cloudinaryReady ? (
        <p className="rounded-xl border px-4 py-3 text-sm" style={{ background: "#F3F4F6", borderColor: LINE, color: "#4B5563" }}>
          Tính năng tải ảnh lên hiện chưa sẵn sàng trên hệ thống — bạn vẫn có thể sửa và xuất bản nội dung chữ.
        </p>
      ) : null}

      {/* Thanh trạng thái + hành động — dính đầu vùng cuộn để luôn thấy nút Lưu/Xuất bản khi sửa form dài. */}
      <div className="sticky top-0 z-10 -mx-5 border-y bg-white/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8" style={{ borderColor: LINE }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {isPublished ? <Badge tone="success">Đã xuất bản</Badge> : <Badge tone="neutral">Chưa xuất bản · đang dùng nội dung mẫu</Badge>}
            {hasDraft ? <Badge tone="warning">Đang có bản nháp chưa xuất bản</Badge> : null}
            {isDirty ? <Badge tone="info">Có thay đổi chưa lưu</Badge> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
              style={{ borderColor: LINE, color: INK }}
            >
              <IconExternalLink className="h-4 w-4" /> Xem trang
              <span className="sr-only">(mở tab mới — hiển thị bản đã xuất bản)</span>
            </Link>
            <GhostButton onClick={restoreLive} disabled={isPending || !hasDraft}>
              {busy("restore") ? "Đang khôi phục..." : "Khôi phục bản đang hiển thị"}
            </GhostButton>
            <GhostButton onClick={saveDraft} disabled={isPending}>
              {busy("save") ? "Đang lưu..." : "Lưu nháp"}
            </GhostButton>
            <PrimaryButton type="button" onClick={publish} disabled={isPending}>
              <IconCheckCircle className="h-4 w-4" /> {busy("publish") ? "Đang xuất bản..." : "Xuất bản"}
            </PrimaryButton>
          </div>
        </div>
        {message ? (
          <p
            role={message.ok ? "status" : "alert"}
            className="mt-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium"
            style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D" } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C" }}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="self-start rounded-2xl border bg-white p-4" style={{ borderColor: LINE }} aria-labelledby="sf-sections-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="sf-sections-heading" className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
              Các phần trên trang
            </h2>
            <span className="text-xs" style={{ color: INK_SOFT }}>
              {visibleCount}/{sections.length} đang hiện
            </span>
          </div>
          <ol className="space-y-1.5">
            {sections.map((s, i) => {
              const isSelected = s.id === selected?.id;
              const label = STOREFRONT_SECTION_LABELS[s.type];
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-xl border py-1 pr-1 pl-1 transition-colors"
                  style={{ borderColor: isSelected ? "#D97706" : LINE, background: isSelected ? "rgba(217,119,6,0.08)" : "white" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleVisible(s.id)}
                    aria-pressed={s.visible}
                    aria-label={`${s.visible ? "Ẩn" : "Hiện"} phần ${label}`}
                    title={s.visible ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                    className={ICON_BTN}
                    style={{ color: s.visible ? "#15803D" : "#9CA3AF" }}
                  >
                    {s.visible ? <IconEye className="h-[18px] w-[18px]" /> : <IconEyeOff className="h-[18px] w-[18px]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center rounded-lg px-1.5 text-left lg:min-h-9"
                  >
                    <span className="w-full truncate text-sm font-medium" style={{ color: s.visible ? INK : "#6B7280" }}>
                      <span className="mr-1 tabular-nums" style={{ color: INK_SOFT }}>
                        {i + 1}.
                      </span>
                      {label}
                    </span>
                    {!s.visible ? <span className="text-[11px] font-semibold text-gray-500">Đang ẩn</span> : null}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Đưa phần ${label} lên`} className={ICON_BTN}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Đưa phần ${label} xuống`} className={ICON_BTN}>
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
            Bấm tên phần để sửa nội dung. Biểu tượng con mắt để ẩn/hiện, mũi tên để đổi thứ tự.
          </p>
        </aside>

        <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }} aria-labelledby="sf-section-editor-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4" style={{ borderColor: LINE }}>
            <h2 id="sf-section-editor-heading" className="font-[family-name:var(--font-heading)] text-lg font-semibold" style={{ color: INK }}>
              {selected ? STOREFRONT_SECTION_LABELS[selected.type] : ""}
            </h2>
            {selected && !selected.visible ? <Badge tone="neutral">Đang ẩn trên trang</Badge> : null}
          </div>

          {selected ? <SectionFields
              key={selected.id}
              section={selected}
              onChange={updateSelectedData}
              products={products}
              reviewOptions={reviewOptions}
              tenantSlug={tenantSlug}
              uploadImage={uploadImage}
            /> : null}
        </section>
      </div>
    </div>
  );
}
