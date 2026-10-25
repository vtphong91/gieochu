import { z } from "zod";
export { MENU_CMS_SLUG } from "./cms-slugs";
import { isSafeEmailAddress, isSafeExternalUrl, isSafeInternalPath } from "./cms-content-guard";
import { isLegalDocumentKey, legalDocumentPath, type LegalDocumentKey } from "../legal/legal-document";

/**
 * ADR-050 mục 1 — menu header/footer hệ thống, lưu ở `CmsPage.slug = "menu"` (`blocks` = live, `blocksDraft` = nháp,
 * mẫu ADR-035). Bố cục header/footer vẫn cố định trong code; CMS chỉ quyết nhãn, đích link, thứ tự, ẩn/hiện.
 *
 *  - Lúc LƯU: `siteMenuSchema` (chặt — link không hợp lệ/không an toàn bị từ chối).
 *  - Lúc ĐỌC: `parseSiteMenu` (phòng thủ — link hỏng bị bỏ riêng, phần hỏng về mặc định).
 *  - Lúc RENDER: `resolveNavLinkHref` dựng `href` thật; `{brand}`/`{năm}` trong dòng bản quyền thay ở server.
 *
 * File chỉ phụ thuộc zod — client component import qua `@gieochu/core/site-menu`.
 */

export const NAV_HEADER_ITEMS_MAX = 5;
export const NAV_CHILDREN_MAX = 8;
export const NAV_FOOTER_COLUMNS_MIN = 1;
export const NAV_FOOTER_COLUMNS_MAX = 4;
export const NAV_FOOTER_LINKS_MIN = 1;
export const NAV_FOOTER_LINKS_MAX = 8;
export const NAV_LABEL_MAX = 32;
export const NAV_CTA_LABEL_MAX = 24;
export const NAV_COLUMN_TITLE_MAX = 32;
export const NAV_FOOTER_DESCRIPTION_MAX = 160;
export const NAV_COPYRIGHT_MAX = 120;
export const NAV_TARGET_MAX = 500;
export const NAV_ID_MAX = 64;

/** ADR-054 mục 6: `legal` = văn bản pháp lý (đích = khoá văn bản) — tự ẩn khi văn bản chưa có bản hiệu lực. */
export const NAV_LINK_KINDS = ["page", "legal", "internal", "external", "email"] as const;
export type NavLinkKind = (typeof NAV_LINK_KINDS)[number];

export const NAV_LINK_KIND_LABELS: Record<NavLinkKind, string> = {
  page: "Trang có sẵn",
  legal: "Văn bản pháp lý",
  internal: "Đường dẫn nội bộ",
  external: "Liên kết ngoài",
  email: "Email",
};

/**
 * "Trang có sẵn" — khoá ổn định → đường dẫn (đổi đường dẫn trong code không làm vỡ menu đã lưu). Ngoài các khoá này,
 * `cms:<slug>` trỏ tới trang CMS chung `/p/<slug>`.
 */
export const NAV_PAGE_PATHS = {
  home: "/",
  shop: "/cua-hang",
  documents: "/cua-hang/tai-lieu",
  pricing: "/pricing",
  register: "/register",
  login: "/login",
} as const;
export type NavPageKey = keyof typeof NAV_PAGE_PATHS;

export const NAV_PAGE_LABELS: Record<NavPageKey, string> = {
  home: "Trang chủ",
  shop: "Cửa hàng",
  documents: "Tất cả tài liệu",
  pricing: "Bảng giá",
  register: "Đăng ký",
  login: "Đăng nhập",
};

const CMS_PAGE_TARGET = /^cms:([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Đường dẫn của một "trang có sẵn"; `null` = khoá không tồn tại. */
export function navPagePath(key: string): string | null {
  if (Object.prototype.hasOwnProperty.call(NAV_PAGE_PATHS, key)) return NAV_PAGE_PATHS[key as NavPageKey];
  const cms = CMS_PAGE_TARGET.exec(key);
  return cms ? `/p/${cms[1]}` : null;
}

/** `href` render được của một đích; `null` = đích không hợp lệ/không an toàn (link bị bỏ khi render). */
export function resolveNavLinkHref(kind: NavLinkKind, target: string): string | null {
  const value = target.trim();
  switch (kind) {
    case "page":
      return navPagePath(value);
    case "legal":
      return isLegalDocumentKey(value) ? legalDocumentPath(value) : null;
    case "internal":
      return isSafeInternalPath(value) ? value : null;
    case "external":
      return isSafeExternalUrl(value) ? value : null;
    case "email":
      return isSafeEmailAddress(value) ? `mailto:${value}` : null;
    default:
      return null;
  }
}

const TARGET_ERROR: Record<NavLinkKind, string> = {
  page: "Chọn một trang có sẵn.",
  legal: "Chọn một văn bản pháp lý.",
  internal: "Đường dẫn nội bộ phải bắt đầu bằng “/” (không “//”, không khoảng trắng).",
  external: "Liên kết ngoài phải là https:// chính thức (không localhost, không *.vercel.app).",
  email: "Email không hợp lệ (nhập địa chỉ, không kèm “mailto:”).",
};

/** Thông báo lỗi đích (dùng chung editor + schema); `null` = hợp lệ. */
export function navTargetError(kind: NavLinkKind, target: string): string | null {
  return resolveNavLinkHref(kind, target) === null ? TARGET_ERROR[kind] : null;
}

const idSchema = z.string().trim().min(1).max(NAV_ID_MAX);
const labelSchema = (max: number) =>
  z.string().trim().min(1, "Nhập nhãn.").max(max, `Tối đa ${max} ký tự.`);

const linkFields = {
  id: idSchema,
  kind: z.enum(NAV_LINK_KINDS),
  target: z.string().trim().max(NAV_TARGET_MAX),
  newTab: z.boolean(),
  visible: z.boolean(),
};

function refineTarget(link: { kind: NavLinkKind; target: string }, ctx: z.RefinementCtx): void {
  const error = navTargetError(link.kind, link.target);
  if (error) ctx.addIssue({ code: "custom", path: ["target"], message: error });
}

export const navLinkSchema = z.object({ ...linkFields, label: labelSchema(NAV_LABEL_MAX) }).superRefine(refineTarget);
export type NavLink = z.infer<typeof navLinkSchema>;

/** Mục cấp 1 của header: có menu con (1 cấp) thì là nhóm — đích riêng bị bỏ qua (không bắt buộc hợp lệ). */
export const navItemSchema = z
  .object({
    ...linkFields,
    label: labelSchema(NAV_LABEL_MAX),
    children: z.array(navLinkSchema).max(NAV_CHILDREN_MAX, `Tối đa ${NAV_CHILDREN_MAX} mục con.`),
  })
  .superRefine((item, ctx) => {
    if (item.children.length === 0) refineTarget(item, ctx);
  });
export type NavItem = z.infer<typeof navItemSchema>;

export const navCtaSchema = z.object({ ...linkFields, label: labelSchema(NAV_CTA_LABEL_MAX) }).superRefine(refineTarget);
export type NavCta = z.infer<typeof navCtaSchema>;

export const navFooterColumnSchema = z.object({
  id: idSchema,
  title: labelSchema(NAV_COLUMN_TITLE_MAX),
  links: z
    .array(navLinkSchema)
    .min(NAV_FOOTER_LINKS_MIN, `Mỗi cột cần ít nhất ${NAV_FOOTER_LINKS_MIN} link.`)
    .max(NAV_FOOTER_LINKS_MAX, `Mỗi cột tối đa ${NAV_FOOTER_LINKS_MAX} link.`),
});
export type NavFooterColumn = z.infer<typeof navFooterColumnSchema>;

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

export const siteMenuSchema = z
  .object({
    header: z.object({
      items: z.array(navItemSchema).max(NAV_HEADER_ITEMS_MAX, `Header tối đa ${NAV_HEADER_ITEMS_MAX} mục.`),
      cta: navCtaSchema,
    }),
    footer: z.object({
      /** Trống = slogan thương hiệu. */
      description: z.string().trim().max(NAV_FOOTER_DESCRIPTION_MAX, `Tối đa ${NAV_FOOTER_DESCRIPTION_MAX} ký tự.`),
      columns: z
        .array(navFooterColumnSchema)
        .min(NAV_FOOTER_COLUMNS_MIN, `Footer cần ít nhất ${NAV_FOOTER_COLUMNS_MIN} cột.`)
        .max(NAV_FOOTER_COLUMNS_MAX, `Footer tối đa ${NAV_FOOTER_COLUMNS_MAX} cột.`),
      /** Token `{năm}` (năm hiện tại giờ VN) và `{brand}` (tên thương hiệu). */
      copyright: z.string().trim().min(1, "Nhập dòng bản quyền.").max(NAV_COPYRIGHT_MAX, `Tối đa ${NAV_COPYRIGHT_MAX} ký tự.`),
    }),
  })
  .superRefine((menu, ctx) => {
    const ids = [
      ...menu.header.items.flatMap((item) => [item.id, ...item.children.map((child) => child.id)]),
      menu.header.cta.id,
      ...menu.footer.columns.flatMap((column) => [column.id, ...column.links.map((link) => link.id)]),
    ];
    if (!uniqueIds(ids)) ctx.addIssue({ code: "custom", path: [], message: "Có id mục menu bị trùng." });
  });
export type SiteMenu = z.infer<typeof siteMenuSchema>;

/** ADR-054 mục 6 — nhãn ngắn (≤ `NAV_LABEL_MAX`) của cột footer "Thông tin" mặc định, theo thứ tự hiển thị. */
const DEFAULT_FOOTER_LEGAL_LINKS: ReadonlyArray<readonly [LegalDocumentKey, string]> = [
  ["terms", "Điều khoản sử dụng"],
  ["privacy", "Chính sách bảo mật"],
  ["content_policy", "Chính sách nội dung"],
  ["copyright", "Cam kết bản quyền"],
  ["usage_license", "Quyền sử dụng tài liệu"],
  ["seller", "Chính sách người bán"],
  ["contact", "Liên hệ"],
];

/** Nhãn CTA mặc định khi có gói miễn phí thật (ADR-021) / khi không có. Loader chọn theo dữ liệu `Plan`. */
export const DEFAULT_HEADER_CTA_LABEL_FREE = "Mở gian hàng miễn phí";
export const DEFAULT_HEADER_CTA_LABEL = "Mở gian hàng";

/**
 * Menu mặc định (chưa xuất bản / dữ liệu hỏng) = menu trước ADR-050 bỏ các mục không có link ("Giáo viên & Coach",
 * cột "Công ty"). Thứ tự header theo nav ngang desktop cũ. ADR-054 mục 6: thêm cột "Thông tin" gồm mọi văn bản pháp lý —
 * link tới văn bản chưa có bản hiệu lực bị bỏ khi render, không còn link nào thì ẩn cả cột.
 */
export function defaultSiteMenu(): SiteMenu {
  return {
    header: {
      items: [
        { id: "nav-pricing", label: "Bảng giá", kind: "page", target: "pricing", newTab: false, visible: true, children: [] },
        { id: "nav-shop", label: "Cửa hàng", kind: "page", target: "shop", newTab: false, visible: true, children: [] },
      ],
      cta: { id: "header-cta", label: DEFAULT_HEADER_CTA_LABEL_FREE, kind: "page", target: "register", newTab: false, visible: true },
    },
    footer: {
      description: "",
      columns: [
        {
          id: "col-explore",
          title: "Khám phá",
          links: [
            { id: "foot-shop", label: "Cửa hàng", kind: "page", target: "shop", newTab: false, visible: true },
            { id: "foot-pricing", label: "Bảng giá", kind: "page", target: "pricing", newTab: false, visible: true },
          ],
        },
        {
          id: "col-info",
          title: "Thông tin",
          links: DEFAULT_FOOTER_LEGAL_LINKS.map(([key, label]) => ({ id: `foot-legal-${key}`, label, kind: "legal" as const, target: key, newTab: false, visible: true })),
        },
      ],
      copyright: "© {năm} {brand}. Bảo lưu mọi quyền.",
    },
  };
}

// ───────────────────────── Parse phòng thủ ─────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseLinks(value: unknown, max: number): NavLink[] {
  if (!Array.isArray(value)) return [];
  const links: NavLink[] = [];
  for (const raw of value) {
    const parsed = navLinkSchema.safeParse(raw);
    if (parsed.success) links.push(parsed.data);
    if (links.length >= max) break;
  }
  return links;
}

/**
 * Đọc `CmsPage.blocks/blocksDraft` của menu (dùng khi RENDER và khi nạp editor): mục/link hỏng bị bỏ riêng; CTA hỏng →
 * CTA mặc định; cột không còn link nào bị bỏ; không còn cột nào → cột mặc định. Trả `null` khi đầu vào không phải object.
 */
export function parseSiteMenu(input: unknown): SiteMenu | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const fallback = defaultSiteMenu();
  const record = asRecord(input);
  const header = asRecord(record.header);
  const footer = asRecord(record.footer);

  const items: NavItem[] = [];
  for (const raw of Array.isArray(header.items) ? header.items : []) {
    const rawItem = asRecord(raw);
    const candidate = { ...rawItem, children: parseLinks(rawItem.children, NAV_CHILDREN_MAX) };
    const parsed = navItemSchema.safeParse(candidate);
    if (parsed.success) items.push(parsed.data);
    if (items.length >= NAV_HEADER_ITEMS_MAX) break;
  }

  const cta = navCtaSchema.safeParse(header.cta);

  const columns: NavFooterColumn[] = [];
  for (const raw of Array.isArray(footer.columns) ? footer.columns : []) {
    const rawColumn = asRecord(raw);
    const parsed = navFooterColumnSchema.safeParse({ ...rawColumn, links: parseLinks(rawColumn.links, NAV_FOOTER_LINKS_MAX) });
    if (parsed.success) columns.push(parsed.data);
    if (columns.length >= NAV_FOOTER_COLUMNS_MAX) break;
  }

  const description = z.string().trim().max(NAV_FOOTER_DESCRIPTION_MAX).safeParse(footer.description);
  const copyright = z.string().trim().min(1).max(NAV_COPYRIGHT_MAX).safeParse(footer.copyright);

  const menu: SiteMenu = {
    header: { items, cta: cta.success ? cta.data : fallback.header.cta },
    footer: {
      description: description.success ? description.data : "",
      columns: columns.length > 0 ? columns : fallback.footer.columns,
      copyright: copyright.success ? copyright.data : fallback.footer.copyright,
    },
  };
  // Id trùng (dữ liệu sửa tay) → schema chặt sẽ từ chối khi lưu; render vẫn dùng được nên giữ nguyên.
  return menu;
}

/** Thay `{năm}` / `{brand}` trong dòng bản quyền (chỉ 2 token, không phải template engine). */
export function applyCopyrightTokens(text: string, values: { year: number; brandName: string }): string {
  return text.replaceAll("{năm}", String(values.year)).replaceAll("{brand}", values.brandName);
}
