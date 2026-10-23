import { cache } from "react";
import {
  applyCopyrightTokens,
  DEFAULT_HEADER_CTA_LABEL,
  DEFAULT_HEADER_CTA_LABEL_FREE,
  defaultSiteMenu,
  DISPLAY_TIME_ZONE,
  MENU_CMS_SLUG,
  parseSiteMenu,
  resolveNavLinkHref,
  type NavLink,
  type SiteMenu,
} from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { getEffectiveBrand } from "./branding";

/**
 * ADR-050 mục 1 — menu header/footer hệ thống từ CMS (`CmsPage` slug `menu`, L1 không RLS → `getPrismaClient()`).
 * Chỉ bản PUBLISHED (`blocks`) được dùng công khai; chưa xuất bản / dữ liệu hỏng → `defaultSiteMenu()`. `cache()`
 * theo request — SiteHeader + SiteFooter cùng trang chỉ đọc DB một lần.
 *
 * Contract render (props cho UI — Phong dựng giao diện theo các kiểu dưới đây):
 *  - Link đã lọc `visible`, `href` đã dựng + kiểm an toàn (link hỏng bị bỏ), `{brand}`/`{năm}` đã thay.
 *  - `external = true` khi không phải đường dẫn nội bộ (dùng `<a>` thay `<Link>`); `newTab` → `target="_blank"` +
 *    `rel="noopener noreferrer"`.
 */

export interface SiteNavLinkView {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
  /** `https://` hoặc `mailto:` — render bằng `<a>`. */
  external: boolean;
}

export interface SiteNavItemView {
  id: string;
  label: string;
  /** `null` = mục nhóm có menu con (không có đích riêng). */
  href: string | null;
  newTab: boolean;
  external: boolean;
  /** Menu con 1 cấp (đã lọc); rỗng = link thường. */
  children: SiteNavLinkView[];
}

export interface SiteFooterColumnView {
  id: string;
  title: string;
  links: SiteNavLinkView[];
}

export interface SiteMenuView {
  header: {
    items: SiteNavItemView[];
    /** Nút kêu gọi cho khách chưa đăng nhập; `null` = ẩn. */
    cta: SiteNavLinkView | null;
  };
  footer: {
    /** Mô tả dưới logo (trống trong CMS → slogan thương hiệu). */
    description: string;
    columns: SiteFooterColumnView[];
    /** Dòng bản quyền đã thay token. */
    copyright: string;
  };
}

export type SiteMenuStatus = "NONE" | "DRAFT" | "PUBLISHED";

/** Năm hiện tại theo giờ hiển thị (`Asia/Ho_Chi_Minh`) — không gõ cứng năm bản quyền. */
export function currentDisplayYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TIME_ZONE, year: "numeric" }).format(now));
}

/** Có gói Miễn phí đang bán thật (ADR-021 Free Forever) — quyết chữ "miễn phí" ở CTA mặc định (ADR-050). */
async function hasActiveFreePlan(): Promise<boolean> {
  const plan = await getPrismaClient().plan.findFirst({ where: { isActive: true, isFree: true }, select: { id: true } });
  return plan !== null;
}

/** Menu đang hiệu lực công khai (chưa resolve). Mặc định: CTA chỉ có chữ "miễn phí" khi có gói Miễn phí đang bán. */
export const getPublishedSiteMenu = cache(async function getPublishedSiteMenu(): Promise<SiteMenu> {
  const page = await getPrismaClient().cmsPage.findUnique({ where: { slug: MENU_CMS_SLUG }, select: { blocks: true, status: true } });
  const published = page?.status === "PUBLISHED" ? parseSiteMenu(page.blocks) : null;
  if (published) return published;
  const menu = defaultSiteMenu();
  menu.header.cta.label = (await hasActiveFreePlan()) ? DEFAULT_HEADER_CTA_LABEL_FREE : DEFAULT_HEADER_CTA_LABEL;
  return menu;
});

function toLinkView(link: Pick<NavLink, "id" | "label" | "kind" | "target" | "newTab">): SiteNavLinkView | null {
  const href = resolveNavLinkHref(link.kind, link.target);
  if (!href) return null;
  return { id: link.id, label: link.label, href, newTab: link.newTab, external: !href.startsWith("/") };
}

/** Chuyển cấu hình menu sang dữ liệu render (lọc ẩn, dựng href, thay token). Dùng chung cho trang công khai và xem trước. */
export function resolveSiteMenu(menu: SiteMenu, values: { brandName: string; slogan: string; year: number }): SiteMenuView {
  const items: SiteNavItemView[] = [];
  for (const item of menu.header.items) {
    if (!item.visible) continue;
    const children = item.children.filter((child) => child.visible).flatMap((child) => toLinkView(child) ?? []);
    if (item.children.length > 0) {
      // Mục nhóm: không còn mục con hiển thị nào → bỏ cả mục.
      if (children.length > 0) items.push({ id: item.id, label: item.label, href: null, newTab: false, external: false, children });
      continue;
    }
    const view = toLinkView(item);
    if (view) items.push({ ...view, children: [] });
  }

  const cta = menu.header.cta.visible ? toLinkView(menu.header.cta) : null;

  const columns = menu.footer.columns
    .map((column) => ({
      id: column.id,
      title: column.title,
      links: column.links.filter((link) => link.visible).flatMap((link) => toLinkView(link) ?? []),
    }))
    .filter((column) => column.links.length > 0);

  return {
    header: { items, cta },
    footer: {
      description: menu.footer.description || values.slogan,
      columns,
      copyright: applyCopyrightTokens(menu.footer.copyright, { year: values.year, brandName: values.brandName }),
    },
  };
}

/** Dữ liệu render header/footer cho request hiện tại. */
export const getSiteMenu = cache(async function getSiteMenu(): Promise<SiteMenuView> {
  const [menu, brand] = await Promise.all([getPublishedSiteMenu(), getEffectiveBrand()]);
  return resolveSiteMenu(menu, { brandName: brand.name, slogan: brand.slogan, year: currentDisplayYear() });
});

export interface SiteMenuEditorData {
  /** Bản đang soạn = nháp ?? live ?? mặc định. */
  menu: SiteMenu;
  /** Bản live đã parse (hoặc mặc định) — cho "Khôi phục bản đang hiển thị". */
  live: SiteMenu;
  hasDraft: boolean;
  status: SiteMenuStatus;
  updatedAt: Date | null;
}

/** Dữ liệu editor `/admin/cms/menu`. Caller phải gác SYSTEM_ADMIN. */
export async function getSiteMenuEditorData(): Promise<SiteMenuEditorData> {
  const page = await getPrismaClient().cmsPage.findUnique({
    where: { slug: MENU_CMS_SLUG },
    select: { blocks: true, blocksDraft: true, status: true, updatedAt: true },
  });
  const parsedLive = page ? parseSiteMenu(page.blocks) : null;
  const live = parsedLive ?? defaultSiteMenu();
  if (!parsedLive) {
    live.header.cta.label = (await hasActiveFreePlan()) ? DEFAULT_HEADER_CTA_LABEL_FREE : DEFAULT_HEADER_CTA_LABEL;
  }
  const draft = page?.blocksDraft != null ? parseSiteMenu(page.blocksDraft) : null;
  return {
    menu: draft ?? live,
    live,
    hasDraft: draft !== null,
    status: page ? page.status : "NONE",
    updatedAt: page?.updatedAt ?? null,
  };
}
