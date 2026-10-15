"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core" — barrel kéo code server-only vào bundle client).
import {
  SHOP_BY_CATEGORY_BLOCKS_MAX,
  SHOP_BY_CATEGORY_BLOCKS_MIN,
  SHOP_BY_CATEGORY_CARDS_MAX,
  SHOP_BY_CATEGORY_CARDS_MIN,
  SHOP_CATEGORIES_VISIBLE_MAX,
  SHOP_CATEGORIES_VISIBLE_MIN,
  SHOP_CATEGORY_MODE_LABELS,
  SHOP_DESCRIPTION_MAX,
  SHOP_EYEBROW_MAX,
  SHOP_FEATURED_TENANTS_MODE_LABELS,
  SHOP_HERO_CHIPS_MAX,
  SHOP_HERO_CHIPS_MIN,
  SHOP_HREF_MAX,
  SHOP_LABEL_MAX,
  SHOP_LIMIT_MAX,
  SHOP_LIMIT_MIN,
  SHOP_MIN_REVIEWS_MAX,
  SHOP_MIN_REVIEWS_MIN,
  SHOP_PINNED_MAX,
  SHOP_PLACEHOLDER_MAX,
  SHOP_SECTION_LABELS,
  SHOP_SUBTITLE_MAX,
  SHOP_TENANT_LIMIT_MAX,
  SHOP_TENANT_LIMIT_MIN,
  SHOP_TITLE_MAX,
  formatShopAvgTenths,
  type ShopCategoryMode,
  type ShopFeaturedTenantsMode,
  type ShopSection,
} from "@gieochu/core/shop-sections";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { Badge, GhostButton, Notice, PrimaryButton } from "../../../_ui/kit";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconChevronDown,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPlus,
} from "../../../_ui/icons";
import { ImageUploadField } from "../../../_ui/image-upload-field";
import { searchHomeProductOptionsAction, searchHomeTenantOptionsAction } from "../../home-editor/actions";
import { PinPicker, type PinOption, type PinPickerCopy } from "../../home-editor/pin-picker";
import { toCategoryPinOption, toProductPinOption, toTenantPinOption } from "../../home-editor/pin-options";
import { publishShopAction, restoreLiveShopAction, saveShopDraftAction, searchShopCategoryOptionsAction } from "../actions";
import {
  AvgTenthsField,
  IntegerField,
  RadioCardGroup,
  RangeSelectField,
  ShopTextAreaField,
  ShopTextField,
  type RadioChoice,
} from "./shop-fields";
import {
  SHOP_FIELD_LABELS,
  SHOP_LIST_FIELDS,
  shopFieldId,
  toShopErrorMap,
  validateShopSections,
  type ShopErrorMap,
  type ShopFieldIssue,
} from "./shop-validation";

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";

/** Đường dẫn trang công khai (GĐ2 — ADR-035). */
const PUBLIC_PATH = "/cua-hang";
/** GĐ2 (ADR-035) đã có trang `/cua-hang` — false sẽ hiện ghi chú "chưa mở được" cạnh nút Xem trang. */
const PUBLIC_PAGE_READY = true;

/** Nút icon vuông: 44px dưới lg (target chạm), 36px từ lg — cùng kích thước với editor trang bán hàng Studio. */
const ICON_BTN = `inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent lg:h-9 lg:w-9 ${FOCUS}`;

export interface ShopEditorPinOptions {
  tenants: PinOption[];
  products: PinOption[];
  categories: PinOption[];
}

export type ShopEditorStatus = "NONE" | "DRAFT" | "PUBLISHED";

type PendingAction = "save" | "publish" | "restore";

async function searchProductPins(query: string, includeIds: string[]): Promise<PinOption[]> {
  return (await searchHomeProductOptionsAction(query, includeIds)).map(toProductPinOption);
}

async function searchTenantPins(query: string, includeIds: string[]): Promise<PinOption[]> {
  return (await searchHomeTenantOptionsAction(query, includeIds)).map(toTenantPinOption);
}

async function searchCategoryPins(query: string, includeIds: string[]): Promise<PinOption[]> {
  return (await searchShopCategoryOptionsAction(query, includeIds)).map(toCategoryPinOption);
}

const PRODUCT_PIN_COPY: Partial<PinPickerCopy> = {
  note: "Ghim riêng cho trang Cửa hàng (không ảnh hưởng trang chủ). Mục ghim hiện trước theo đúng thứ tự; còn chỗ thì tự bù bằng tài liệu được chọn tự động.",
  emptyPinned: "Chưa ghim tài liệu nào — kệ tự chọn tài liệu công khai.",
};

const TENANT_PIN_COPY: Partial<PinPickerCopy> = {
  note: "Gian hàng ghim hiện trước theo đúng thứ tự; còn chỗ thì tự bù theo chế độ xếp hạng ở trên.",
  emptyPinned: "Chưa ghim gian hàng nào — danh sách xếp hoàn toàn theo chế độ đã chọn.",
};

function categoryCopy(unit: string): Partial<PinPickerCopy> {
  return {
    note: "Thứ tự chọn là thứ tự hiển thị. Danh mục đang tắt hoặc không còn tài liệu công khai sẽ bị bỏ qua.",
    emptyPinned: "Chưa chọn danh mục nào — chế độ chọn tay cần ít nhất 1 danh mục.",
    searchHint: "Gõ để lọc theo tên danh mục.",
    pinAction: "Chọn",
    unpinAction: "Bỏ chọn",
    pinnedState: "Đã chọn",
    unavailable: "Danh mục đang tắt hoặc chưa có tài liệu công khai — sẽ bị bỏ qua, nên bỏ chọn.",
    overLimit: (limit) => `Ngoài số ${unit} hiển thị (${limit}) — sẽ không hiện.`,
    full: (max) => `Đã chọn đủ ${max} danh mục — bỏ bớt để chọn thêm.`,
    noMatch: (query) => `Không có danh mục nào khớp “${query}”. Thử từ khoá ngắn hơn.`,
    noOptions: "Chưa có danh mục nào để chọn.",
    PinIcon: IconPlus,
  };
}

const CATEGORY_MODE_CHOICES: RadioChoice<ShopCategoryMode>[] = [
  { value: "AUTO", label: SHOP_CATEGORY_MODE_LABELS.AUTO, description: "Lấy các danh mục có nhiều tài liệu công khai nhất, tự cập nhật theo dữ liệu." },
  { value: "MANUAL", label: SHOP_CATEGORY_MODE_LABELS.MANUAL, description: "Bạn chọn danh mục và thứ tự hiển thị (cần ít nhất 1 danh mục)." },
];

const TENANT_MODE_CHOICES: RadioChoice<ShopFeaturedTenantsMode>[] = [
  {
    value: "SALES_30D",
    label: SHOP_FEATURED_TENANTS_MODE_LABELS.SALES_30D,
    description: "Bán chạy 30 ngày — số bán chỉ dùng để xếp hạng, không hiển thị. Thiếu thì bù theo tổng đã bán, đánh giá, mới nhất.",
  },
  {
    value: "TOP_RATED",
    label: SHOP_FEATURED_TENANTS_MODE_LABELS.TOP_RATED,
    description: "Xếp theo điểm trung bình tổng các tài liệu của gian hàng; chỉ tính gian hàng đủ số đánh giá tối thiểu bên dưới.",
  },
];

/** Ghi chú cố định đầu form của section lấy dữ liệu thật (ADR-035: CMS chỉ lưu nhãn/cấu hình). */
function LiveDataNote({ children }: { children: ReactNode }) {
  return <Notice tone="info">{children}</Notice>;
}

/** Nhóm field có tiêu đề nhỏ (không dùng heading — tránh nhảy cấp). */
function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: LINE }}>
      <p className="mb-3 text-sm font-semibold" style={{ color: INK }}>
        {title}
      </p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SectionFields({
  section,
  errors,
  pinOptions,
  onChange,
}: {
  section: ShopSection;
  errors: Record<string, string>;
  pinOptions: ShopEditorPinOptions;
  onChange: (data: ShopSection["data"]) => void;
}) {
  const id = (field: string) => shopFieldId(section.type, field);
  const err = (field: string) => errors[field];

  /** Tiêu đề + mô tả ngắn của các kệ. */
  function titleFields(d: { title: string; subtitle: string }, set: (patch: { title?: string; subtitle?: string }) => void) {
    return (
      <>
        <ShopTextField id={id("title")} label="Tiêu đề" value={d.title} max={SHOP_TITLE_MAX} error={err("title")} onChange={(title) => set({ title })} />
        <ShopTextAreaField id={id("subtitle")} label="Mô tả ngắn" rows={2} value={d.subtitle} max={SHOP_SUBTITLE_MAX} error={err("subtitle")} onChange={(subtitle) => set({ subtitle })} />
      </>
    );
  }

  function productLimit(value: number, set: (limit: number) => void, hint?: string) {
    return (
      <RangeSelectField
        id={id("limit")}
        label="Số thẻ hiển thị"
        min={SHOP_LIMIT_MIN}
        max={SHOP_LIMIT_MAX}
        unit="thẻ"
        value={value}
        error={err("limit")}
        hint={hint}
        onChange={set}
      />
    );
  }

  switch (section.type) {
    case "hero": {
      const d = section.data;
      const chips = d.popularChips;
      return (
        <div className="space-y-4">
          <ShopTextField id={id("eyebrow")} label="Dòng nhỏ trên tiêu đề" value={d.eyebrow} max={SHOP_EYEBROW_MAX} error={err("eyebrow")} onChange={(eyebrow) => onChange({ ...d, eyebrow })} />
          <ShopTextField id={id("title")} label="Tiêu đề trang (H1)" value={d.title} max={SHOP_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField id={id("subtitle")} label="Đoạn mô tả" value={d.subtitle} max={SHOP_SUBTITLE_MAX} error={err("subtitle")} onChange={(subtitle) => onChange({ ...d, subtitle })} />

          <FieldGroup title="Ô tìm kiếm">
            <div className="grid gap-4 sm:grid-cols-2">
              <ShopTextField
                id={id("searchLabel")}
                label="Nhãn ô tìm kiếm"
                hint="Hiện phía trên ô tìm"
                value={d.searchLabel}
                max={SHOP_LABEL_MAX}
                error={err("searchLabel")}
                onChange={(searchLabel) => onChange({ ...d, searchLabel })}
              />
              <ShopTextField
                id={id("searchPlaceholder")}
                label="Chữ gợi ý trong ô tìm"
                hint="Chữ mờ khi chưa gõ"
                value={d.searchPlaceholder}
                max={SHOP_PLACEHOLDER_MAX}
                error={err("searchPlaceholder")}
                onChange={(searchPlaceholder) => onChange({ ...d, searchPlaceholder })}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Chip danh mục phổ biến (dưới ô tìm)">
            <RadioCardGroup
              name={id("popularChips-mode")}
              legend="Cách chọn danh mục"
              value={chips.mode}
              choices={CATEGORY_MODE_CHOICES}
              onChange={(mode) => onChange({ ...d, popularChips: { ...chips, mode } })}
            />
            <RangeSelectField
              id={id("popularChips.max")}
              label="Số chip tối đa"
              min={SHOP_HERO_CHIPS_MIN}
              max={SHOP_HERO_CHIPS_MAX}
              unit="chip"
              value={chips.max}
              error={err("popularChips.max")}
              onChange={(max) => onChange({ ...d, popularChips: { ...chips, max } })}
            />
            {chips.mode === "MANUAL" ? (
              <PinPicker
                id={id("popularChips.categoryIds")}
                label="Danh mục hiện thành chip"
                searchLabel="Tìm danh mục để thêm"
                searchPlaceholder="Tên danh mục…"
                value={chips.categoryIds}
                max={SHOP_HERO_CHIPS_MAX}
                limit={chips.max}
                initialOptions={pinOptions.categories}
                search={searchCategoryPins}
                copy={categoryCopy("chip")}
                error={err("popularChips.categoryIds")}
                onChange={(categoryIds) => onChange({ ...d, popularChips: { ...chips, categoryIds } })}
              />
            ) : chips.categoryIds.length > 0 ? (
              <p className="text-xs" style={{ color: INK_SOFT }}>
                Đang có {chips.categoryIds.length} danh mục chọn tay được giữ lại — chỉ dùng khi chuyển về “{SHOP_CATEGORY_MODE_LABELS.MANUAL}”.
              </p>
            ) : null}
          </FieldGroup>

          <ImageUploadField
            label="Ảnh minh hoạ (để trống = dùng minh hoạ mặc định)"
            hint="Ảnh tải lên Cloudinary của hệ thống."
            value={d.imageUrl ?? ""}
            onChange={(url) => {
              const next = { ...d };
              if (url) next.imageUrl = url;
              else delete next.imageUrl;
              onChange(next);
            }}
          />
          {err("imageUrl") ? (
            <p role="alert" className="text-sm" style={{ color: "#DC2626" }}>
              {err("imageUrl")}
            </p>
          ) : null}
          <LiveDataNote>Thẻ số liệu cạnh ô tìm lấy từ dữ liệu thật; số liệu bằng 0 tự ẩn.</LiveDataNote>
        </div>
      );
    }
    case "categories": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Ô danh mục lấy tự động từ danh mục đang bật có tài liệu công khai. Phần vượt số ô hiện ngay được gom vào mục mở rộng “Xem thêm”.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          <RangeSelectField
            id={id("maxVisible")}
            label="Số ô hiện ngay"
            min={SHOP_CATEGORIES_VISIBLE_MIN}
            max={SHOP_CATEGORIES_VISIBLE_MAX}
            unit="ô"
            value={d.maxVisible}
            error={err("maxVisible")}
            onChange={(maxVisible) => onChange({ ...d, maxVisible })}
          />
        </div>
      );
    }
    case "featured": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Thẻ lấy từ tài liệu công khai: ảnh bìa, tên, gian hàng, giá hiệu lực, điểm đánh giá, số đã bán.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          {productLimit(d.limit, (limit) => onChange({ ...d, limit }), `Từ ${SHOP_LIMIT_MIN} đến ${SHOP_LIMIT_MAX} thẻ. Mục ghim vượt số này sẽ không hiện.`)}
          <PinPicker
            id={id("pinnedProductIds")}
            label="Tài liệu ghim trước"
            searchLabel="Tìm tài liệu để ghim"
            searchPlaceholder="Tên tài liệu…"
            value={d.pinnedProductIds}
            max={SHOP_PINNED_MAX}
            limit={d.limit}
            initialOptions={pinOptions.products}
            search={searchProductPins}
            copy={PRODUCT_PIN_COPY}
            error={err("pinnedProductIds")}
            onChange={(pinnedProductIds) => onChange({ ...d, pinnedProductIds })}
          />
        </div>
      );
    }
    case "byCategory": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Mỗi khối là một danh mục; tài liệu trong khối xếp theo bán chạy, rồi điểm đánh giá, rồi mới nhất.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          <div className="grid gap-4 sm:grid-cols-2">
            <RangeSelectField
              id={id("blockCount")}
              label="Số khối danh mục"
              min={SHOP_BY_CATEGORY_BLOCKS_MIN}
              max={SHOP_BY_CATEGORY_BLOCKS_MAX}
              unit="khối"
              value={d.blockCount}
              error={err("blockCount")}
              onChange={(blockCount) => onChange({ ...d, blockCount })}
            />
            <RangeSelectField
              id={id("cardsPerBlock")}
              label="Số thẻ mỗi khối"
              min={SHOP_BY_CATEGORY_CARDS_MIN}
              max={SHOP_BY_CATEGORY_CARDS_MAX}
              unit="thẻ"
              value={d.cardsPerBlock}
              error={err("cardsPerBlock")}
              onChange={(cardsPerBlock) => onChange({ ...d, cardsPerBlock })}
            />
          </div>
          <RadioCardGroup name={id("mode")} legend="Cách chọn danh mục" value={d.mode} choices={CATEGORY_MODE_CHOICES} onChange={(mode) => onChange({ ...d, mode })} />
          {d.mode === "MANUAL" ? (
            <PinPicker
              id={id("categoryIds")}
              label="Danh mục hiện thành khối"
              searchLabel="Tìm danh mục để thêm"
              searchPlaceholder="Tên danh mục…"
              value={d.categoryIds}
              max={SHOP_BY_CATEGORY_BLOCKS_MAX}
              limit={d.blockCount}
              initialOptions={pinOptions.categories}
              search={searchCategoryPins}
              copy={categoryCopy("khối")}
              error={err("categoryIds")}
              onChange={(categoryIds) => onChange({ ...d, categoryIds })}
            />
          ) : d.categoryIds.length > 0 ? (
            <p className="text-xs" style={{ color: INK_SOFT }}>
              Đang có {d.categoryIds.length} danh mục chọn tay được giữ lại — chỉ dùng khi chuyển về “{SHOP_CATEGORY_MODE_LABELS.MANUAL}”.
            </p>
          ) : null}
        </div>
      );
    }
    case "bestSellers": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Xếp theo tổng số đã bán của tài liệu (mọi thời gian), kèm nhãn thứ hạng #1, #2…</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          {productLimit(d.limit, (limit) => onChange({ ...d, limit }))}
        </div>
      );
    }
    case "newest": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Tài liệu công khai mới đăng bán gần nhất.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          {productLimit(d.limit, (limit) => onChange({ ...d, limit }))}
        </div>
      );
    }
    case "topRated": {
      const d = section.data;
      const criteriaReady = Number.isInteger(d.minReviews) && Number.isInteger(d.minAvgTenths);
      return (
        <div className="space-y-4">
          <LiveDataNote>Chỉ hiện tài liệu đạt cả hai ngưỡng bên dưới. Tiêu chí được ghi rõ dưới tiêu đề trên trang.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          {productLimit(d.limit, (limit) => onChange({ ...d, limit }))}
          <FieldGroup title="Ngưỡng “Đánh giá cao”">
            <div className="grid gap-4 sm:grid-cols-2">
              <IntegerField
                id={id("minReviews")}
                label="Số đánh giá tối thiểu"
                min={SHOP_MIN_REVIEWS_MIN}
                max={SHOP_MIN_REVIEWS_MAX}
                value={d.minReviews}
                error={err("minReviews")}
                onChange={(minReviews) => onChange({ ...d, minReviews })}
              />
              <AvgTenthsField id={id("minAvgTenths")} label="Điểm trung bình tối thiểu" value={d.minAvgTenths} error={err("minAvgTenths")} onChange={(minAvgTenths) => onChange({ ...d, minAvgTenths })} />
            </div>
            <p className="text-xs" style={{ color: INK_SOFT }} aria-live="polite">
              {criteriaReady ? (
                <>
                  Tiêu chí hiển thị: <strong style={{ color: INK }}>từ {d.minReviews} đánh giá, điểm trung bình từ {formatShopAvgTenths(d.minAvgTenths)}</strong>.
                </>
              ) : (
                "Nhập đủ hai ngưỡng hợp lệ để xem tiêu chí."
              )}
            </p>
          </FieldGroup>
        </div>
      );
    }
    case "featuredTenants": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Thẻ lấy từ gian hàng đang hoạt động có tài liệu công khai: tên, logo, tổng đã bán, điểm đánh giá.</LiveDataNote>
          {titleFields(d, (patch) => onChange({ ...d, ...patch }))}
          <RadioCardGroup name={id("mode")} legend="Chế độ xếp hạng" value={d.mode} choices={TENANT_MODE_CHOICES} onChange={(mode) => onChange({ ...d, mode })} />
          {d.mode === "TOP_RATED" ? (
            <IntegerField
              id={id("minReviews")}
              label="Tổng số đánh giá tối thiểu của gian hàng"
              min={SHOP_MIN_REVIEWS_MIN}
              max={SHOP_MIN_REVIEWS_MAX}
              value={d.minReviews}
              error={err("minReviews")}
              hint={`Từ ${SHOP_MIN_REVIEWS_MIN} đến ${SHOP_MIN_REVIEWS_MAX}. Chỉ dùng ở chế độ “${SHOP_FEATURED_TENANTS_MODE_LABELS.TOP_RATED}”.`}
              onChange={(minReviews) => onChange({ ...d, minReviews })}
            />
          ) : null}
          <RangeSelectField
            id={id("limit")}
            label="Số gian hàng hiển thị"
            min={SHOP_TENANT_LIMIT_MIN}
            max={SHOP_TENANT_LIMIT_MAX}
            unit="gian hàng"
            value={d.limit}
            error={err("limit")}
            hint={`Từ ${SHOP_TENANT_LIMIT_MIN} đến ${SHOP_TENANT_LIMIT_MAX} gian hàng. Mục ghim vượt số này sẽ không hiện.`}
            onChange={(limit) => onChange({ ...d, limit })}
          />
          <PinPicker
            id={id("pinnedTenantIds")}
            label="Gian hàng ghim trước"
            searchLabel="Tìm gian hàng để ghim"
            searchPlaceholder="Tên gian hàng…"
            value={d.pinnedTenantIds}
            max={SHOP_PINNED_MAX}
            limit={d.limit}
            initialOptions={pinOptions.tenants}
            search={searchTenantPins}
            copy={TENANT_PIN_COPY}
            error={err("pinnedTenantIds")}
            onChange={(pinnedTenantIds) => onChange({ ...d, pinnedTenantIds })}
          />
        </div>
      );
    }
    case "ctaOpenStore": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <ShopTextField id={id("eyebrow")} label="Dòng nhỏ trên tiêu đề" value={d.eyebrow} max={SHOP_EYEBROW_MAX} error={err("eyebrow")} onChange={(eyebrow) => onChange({ ...d, eyebrow })} />
          <ShopTextField id={id("title")} label="Tiêu đề" value={d.title} max={SHOP_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField id={id("description")} label="Đoạn mô tả" value={d.description} max={SHOP_DESCRIPTION_MAX} error={err("description")} onChange={(description) => onChange({ ...d, description })} />
          <FieldGroup title="Nút kêu gọi">
            <div className="grid gap-4 sm:grid-cols-2">
              <ShopTextField id={id("cta.label")} label="Nhãn nút" value={d.cta.label} max={SHOP_LABEL_MAX} error={err("cta.label")} onChange={(label) => onChange({ ...d, cta: { ...d.cta, label } })} />
              <ShopTextField
                id={id("cta.href")}
                label="Đường dẫn nút"
                hint="Đường dẫn nội bộ bắt đầu bằng /, vd /register"
                placeholder="/register"
                value={d.cta.href}
                max={SHOP_HREF_MAX}
                error={err("cta.href")}
                onChange={(href) => onChange({ ...d, cta: { ...d.cta, href } })}
              />
            </div>
          </FieldGroup>
        </div>
      );
    }
  }
}

function formatSavedAt(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ShopSectionsEditor({
  initialSections,
  live,
  initialHasDraft,
  initialStatus,
  updatedAtLabel,
  pinOptions,
}: {
  initialSections: ShopSection[];
  live: ShopSection[];
  initialHasDraft: boolean;
  initialStatus: ShopEditorStatus;
  /** Lần sửa gần nhất đã định dạng ở server (Asia/Ho_Chi_Minh); null khi chưa có dòng. */
  updatedAtLabel: string | null;
  pinOptions: ShopEditorPinOptions;
}) {
  const [sections, setSections] = useState<ShopSection[]>(initialSections);
  const [liveSections, setLiveSections] = useState<ShopSection[]>(live);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [status, setStatus] = useState<ShopEditorStatus>(initialStatus);
  const [savedLabel, setSavedLabel] = useState<string | null>(updatedAtLabel);
  const [selectedId, setSelectedId] = useState<string>(initialSections[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  /** Đã bấm Lưu/Xuất bản ít nhất 1 lần → bật hiển thị lỗi (và cập nhật lỗi theo từng thay đổi). */
  const [attempted, setAttempted] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialSections));
  /** Yêu cầu focus sau khi render (id phần tử + bộ đếm để kích hoạt lại cùng id). */
  /** Tăng khi khôi phục — buộc form dựng lại để ô gõ tay (số, điểm) bỏ chuỗi đang gõ dở. */
  const [formVersion, setFormVersion] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ target: string; seq: number } | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);

  const isDirty = JSON.stringify(sections) !== savedSnapshot;
  const issues: ShopFieldIssue[] = attempted ? validateShopSections(sections) : [];
  const errorMap: ShopErrorMap = toShopErrorMap(issues);
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];
  const visibleCount = sections.filter((s) => s.visible).length;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "__summary") {
      summaryRef.current?.focus();
      return;
    }
    const el = document.getElementById(focusRequest.target);
    if (el) el.focus();
    else editorHeadingRef.current?.focus();
  }, [focusRequest]);

  function requestFocus(target: string) {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }

  function updateSelectedData(data: ShopSection["data"]) {
    setSections((prev) => prev.map((s) => (s.id === selected?.id ? ({ ...s, data } as ShopSection) : s)));
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

  function goToIssue(issue: ShopFieldIssue) {
    setSelectedId(issue.sectionId);
    const fieldId = shopFieldId(issue.sectionType, issue.field);
    requestFocus(SHOP_LIST_FIELDS.has(issue.field) ? `${fieldId}-search` : fieldId);
  }

  /** Kiểm tra trước khi gửi; lỗi → hiện tóm tắt + focus vào đó, không gọi server. */
  function passesClientCheck(): boolean {
    setAttempted(true);
    if (validateShopSections(sections).length === 0) return true;
    setMessage(null);
    requestFocus("__summary");
    return false;
  }

  function saveDraft() {
    if (!passesClientCheck()) return;
    const snapshot = JSON.stringify(sections);
    setPendingAction("save");
    startTransition(async () => {
      const result = await saveShopDraftAction(sections);
      if (result.success) {
        setHasDraft(true);
        setStatus((prev) => (prev === "NONE" ? "DRAFT" : prev));
        setSavedSnapshot(snapshot);
        setSavedLabel(formatSavedAt(new Date()));
      }
      setMessage(result.success ? { ok: true, text: "Đã lưu bản nháp — trang Cửa hàng công khai chưa thay đổi." } : { ok: false, text: result.error ?? "Lưu nháp thất bại." });
    });
  }

  function publish() {
    if (!passesClientCheck()) return;
    const snapshot = JSON.stringify(sections);
    const published = sections;
    setPendingAction("publish");
    startTransition(async () => {
      const result = await publishShopAction(published);
      if (result.success) {
        setHasDraft(false);
        setStatus("PUBLISHED");
        setLiveSections(published);
        setSavedSnapshot(snapshot);
        setSavedLabel(formatSavedAt(new Date()));
      }
      setMessage(result.success ? { ok: true, text: "Đã xuất bản — cấu hình trang Cửa hàng đã cập nhật." } : { ok: false, text: result.error ?? "Xuất bản thất bại." });
    });
  }

  function restoreLive() {
    const target = status === "PUBLISHED" ? "bản đang hiển thị" : "cấu hình mặc định";
    if (!window.confirm(`Bỏ bản nháp và mọi thay đổi chưa xuất bản, quay về ${target}? Thao tác này không hoàn tác được.`)) return;
    setPendingAction("restore");
    startTransition(async () => {
      const result = await restoreLiveShopAction();
      if (!result.success) {
        setMessage({ ok: false, text: result.error ?? "Khôi phục thất bại." });
        return;
      }
      setSections(liveSections);
      setSelectedId((prev) => (liveSections.some((s) => s.id === prev) ? prev : (liveSections[0]?.id ?? "")));
      setHasDraft(false);
      setAttempted(false);
      setFormVersion((v) => v + 1);
      setSavedSnapshot(JSON.stringify(liveSections));
      setMessage({ ok: true, text: status === "PUBLISHED" ? "Đã khôi phục về bản đang hiển thị." : "Đã khôi phục về cấu hình mặc định." });
    });
  }

  const busy = (action: PendingAction) => isPending && pendingAction === action;

  return (
    <div className="mt-6 space-y-4">
      {status === "NONE" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa lưu lần nào — đang hiển thị cấu hình mặc định.</strong> Lần Lưu nháp hoặc Xuất bản đầu tiên sẽ tạo cấu hình trang Cửa hàng.
        </Notice>
      ) : status === "DRAFT" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa xuất bản lần nào.</strong> Trang Cửa hàng công khai dùng cấu hình mặc định cho tới khi bạn bấm Xuất bản.
        </Notice>
      ) : null}

      {/* Thanh trạng thái + hành động — dính đầu vùng cuộn để luôn thấy nút khi sửa form dài. */}
      <div className="sticky top-0 z-10 -mx-5 border-y bg-white/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8" style={{ borderColor: LINE }}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {status === "PUBLISHED" ? (
              <Badge tone="success">Đã xuất bản</Badge>
            ) : status === "DRAFT" ? (
              <Badge tone="neutral">Chưa xuất bản</Badge>
            ) : (
              <Badge tone="neutral">Chưa lưu · cấu hình mặc định</Badge>
            )}
            {hasDraft ? <Badge tone="warning">Có nháp chưa xuất bản</Badge> : null}
            {isDirty ? <Badge tone="info">Có thay đổi chưa lưu</Badge> : null}
            {savedLabel ? (
              <span className="text-xs" style={{ color: INK_SOFT }}>
                Lưu lần cuối: {savedLabel}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={PUBLIC_PATH}
              target="_blank"
              rel="noreferrer"
              aria-describedby={PUBLIC_PAGE_READY ? undefined : "shop-public-note"}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 lg:min-h-0 ${FOCUS}`}
              style={{ borderColor: LINE, color: INK }}
            >
              <IconExternalLink className="h-4 w-4" /> Xem trang
              <span className="sr-only">(mở tab mới — hiển thị bản đã xuất bản)</span>
            </Link>
            <GhostButton onClick={restoreLive} disabled={isPending || (!hasDraft && !isDirty)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}>
              {busy("restore") ? "Đang khôi phục..." : "Khôi phục bản đang hiển thị"}
            </GhostButton>
            <GhostButton onClick={saveDraft} disabled={isPending} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}>
              {busy("save") ? "Đang lưu..." : "Lưu nháp"}
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={publish}
              disabled={isPending}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}
            >
              <IconCheckCircle className="h-4 w-4" /> {busy("publish") ? "Đang xuất bản..." : "Xuất bản"}
            </PrimaryButton>
          </div>
        </div>
        {!PUBLIC_PAGE_READY ? (
          <p id="shop-public-note" className="mt-2 text-xs" style={{ color: INK_SOFT }}>
            Trang công khai {PUBLIC_PATH} có ở giai đoạn 2 — hiện “Xem trang” chưa mở được nội dung.
          </p>
        ) : null}
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

      {issues.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="shop-error-summary-title"
          className={`rounded-xl border px-4 py-3 ${FOCUS}`}
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }}
        >
          <h2 id="shop-error-summary-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#B91C1C" }}>
            <IconAlertTriangle className="h-4 w-4 shrink-0" /> Chưa lưu được — còn {issues.length} lỗi cần sửa
          </h2>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li key={`${issue.sectionId}-${issue.field}`}>
                <button
                  type="button"
                  onClick={() => goToIssue(issue)}
                  className={`min-h-11 cursor-pointer rounded text-left text-sm underline underline-offset-2 lg:min-h-0 ${FOCUS}`}
                  style={{ color: "#B91C1C" }}
                >
                  {SHOP_SECTION_LABELS[issue.sectionType]}
                  {issue.field ? ` · ${SHOP_FIELD_LABELS[issue.field] ?? issue.field}` : ""}: {issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border bg-white p-4" style={{ borderColor: LINE }} aria-labelledby="shop-sections-heading">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="shop-sections-heading" className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
              Các khu vực trên trang
            </h2>
            <span className="text-xs" style={{ color: INK_SOFT }}>
              {visibleCount}/{sections.length} đang hiện
            </span>
          </div>
          <ol className="space-y-1.5">
            {sections.map((s, i) => {
              const isSelected = s.id === selected?.id;
              const label = SHOP_SECTION_LABELS[s.type];
              const errorCount = Object.keys(errorMap[s.id] ?? {}).length;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-xl border p-1 transition-colors"
                  style={{ borderColor: isSelected ? brandColors.accent : LINE, background: isSelected ? brandColors.accentSoft : "white" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleVisible(s.id)}
                    aria-pressed={s.visible}
                    aria-label={`${s.visible ? "Ẩn" : "Hiện"} khu vực ${label}`}
                    title={s.visible ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                    className={ICON_BTN}
                    style={{ color: s.visible ? "#15803D" : "#6B7280" }}
                  >
                    {s.visible ? <IconEye className="h-[18px] w-[18px]" /> : <IconEyeOff className="h-[18px] w-[18px]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center rounded-lg px-1.5 text-left lg:min-h-9 ${FOCUS}`}
                  >
                    <span className="w-full truncate text-sm font-medium" style={{ color: s.visible ? INK : INK_SOFT }}>
                      <span className="mr-1 tabular-nums" style={{ color: INK_SOFT }}>
                        {i + 1}.
                      </span>
                      {label}
                    </span>
                    {!s.visible || errorCount > 0 ? (
                      <span className="flex flex-wrap gap-x-2 text-[11px] font-semibold">
                        {!s.visible ? <span style={{ color: INK_SOFT }}>Đang ẩn</span> : null}
                        {errorCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5" style={{ color: "#B91C1C" }}>
                            <IconAlertTriangle className="h-3 w-3" /> {errorCount} lỗi
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Đưa khu vực ${label} lên`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Đưa khu vực ${label} xuống`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
            Bấm tên khu vực để sửa. Biểu tượng con mắt để ẩn/hiện, mũi tên để đổi thứ tự. Khu vực không có dữ liệu sẽ tự ẩn trên trang.
          </p>
        </aside>

        <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }} aria-labelledby="shop-section-editor-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b pb-4" style={{ borderColor: LINE }}>
            <h2
              id="shop-section-editor-heading"
              ref={editorHeadingRef}
              tabIndex={-1}
              className="font-[family-name:var(--font-heading)] text-lg font-semibold outline-none"
              style={{ color: INK }}
            >
              {selected ? SHOP_SECTION_LABELS[selected.type] : ""}
            </h2>
            {selected && !selected.visible ? <Badge tone="neutral">Đang ẩn trên trang</Badge> : null}
          </div>
          <p className="mb-4 text-xs" style={{ color: INK_SOFT }}>
            Mọi ô chữ đều bắt buộc.
          </p>
          {selected ? (
            <SectionFields key={`${selected.id}-${formVersion}`} section={selected} errors={errorMap[selected.id] ?? {}} pinOptions={pinOptions} onChange={updateSelectedData} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
