import {
  applyPricingTemplateDeep,
  computeCycleSavingsPercent,
  defaultPricingSections,
  IMPLEMENTED_PLAN_FEATURES,
  parsePricingSections,
  PRICING_CMS_SLUG,
  resolvePricingPlanSlots,
  type PlanFeatureKey,
  type PricingCtaKey,
  type PricingCtaLabels,
  type PricingPlanCardItem,
  type PricingSection,
} from "@gieochu/core";
import type { PricingSectionData } from "@gieochu/core/pricing-sections";
import { getPrismaClient } from "@gieochu/db";
import type { PaymentProviderId } from "@gieochu/payments";
import { getEffectiveBrand } from "./branding";
import { getHomeStats, type HomeStats } from "./home";
import { getEnabledPlatformProviders } from "./platform-payment";
import { getCurrentUser } from "./session";
import { getSystemSettings } from "./system-settings";

/**
 * ADR-041 A — dữ liệu trang Bảng giá (CMS `CmsPage` slug `pricing`, L1 không RLS → `getPrismaClient()`).
 *  - `getPricingCmsEditorData()` (C2): cho editor `/admin/cms/pricing` — caller gác SYSTEM_ADMIN.
 *  - `getPricingPageData({ preview })` (C4 + C6): cho trang công khai `/pricing`. Giá/hạn mức/cờ chỉ đọc từ `Plan`;
 *    `viewer` chỉ đọc thuê bao của CHÍNH người xem (tra `Tenant.ownerId`, ADR-022). Xem trước nháp chỉ SYSTEM_ADMIN.
 */

export type PricingCmsStatus = "NONE" | "DRAFT" | "PUBLISHED";

export interface PricingPlanInfo {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
  imageStorageMb: number;
  isFree: boolean;
  isActive: boolean;
  /** Cờ tính năng đang bật của gói (chỉ khoá hợp lệ). */
  features: Partial<Record<PlanFeatureKey, boolean>>;
}

const PLAN_SELECT = {
  id: true,
  code: true,
  name: true,
  priceVnd: true,
  interval: true,
  intervalCount: true,
  maxProducts: true,
  storageMb: true,
  maxFileMb: true,
  imageStorageMb: true,
  isFree: true,
  isActive: true,
  features: true,
} as const;

function toPlanInfo(row: {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
  imageStorageMb: number;
  isFree: boolean;
  isActive: boolean;
  features: unknown;
}): PricingPlanInfo {
  const raw = typeof row.features === "object" && row.features !== null ? (row.features as Record<string, unknown>) : {};
  const features: Partial<Record<PlanFeatureKey, boolean>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true) features[key as PlanFeatureKey] = true;
  }
  return { ...row, features };
}

/** Mọi gói (kể cả đã tắt) — gói Free trước, rồi giá tăng dần. */
async function loadPlans(where: { isActive?: boolean } = {}): Promise<PricingPlanInfo[]> {
  const rows = await getPrismaClient().plan.findMany({ where, orderBy: [{ isFree: "desc" }, { priceVnd: "asc" }, { createdAt: "asc" }], select: PLAN_SELECT });
  return rows.map(toPlanInfo);
}

async function loadPricingRow() {
  return getPrismaClient().cmsPage.findUnique({
    where: { slug: PRICING_CMS_SLUG },
    select: { blocks: true, blocksDraft: true, status: true, updatedAt: true, seoTitle: true, seoDescription: true },
  });
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

// ───────────────────────── C2 — editor ─────────────────────────

export interface PricingCmsEditorData {
  /** Bản đang soạn = nháp ?? live ?? mặc định (đã parse phòng thủ, luôn đủ 9 section). */
  sections: PricingSection[];
  /** Bản live đã parse (chưa có → mặc định) — cho "Khôi phục bản đang hiển thị". */
  live: PricingSection[];
  hasDraft: boolean;
  status: PricingCmsStatus;
  updatedAt: Date | null;
  /** SEO hiện lưu (cột riêng, không có nháp — áp dụng ngay khi dòng đã PUBLISHED); chưa có → "". */
  seoTitle: string;
  seoDescription: string;
  /** Mọi gói, kể cả đã tắt (editor báo "Gói đang tắt"). */
  plans: PricingPlanInfo[];
  /** Số liệu thật hiện tại (chỉ đọc, = 0 sẽ tự ẩn ngoài trang). */
  stats: HomeStats;
  /** Cổng thanh toán nền tảng đang bật (không có → section phương thức thanh toán tự ẩn). */
  enabledProviders: PaymentProviderId[];
  graceDays: number;
  /** Cờ tính năng được phép quảng cáo (ADR-041 A3) — cờ khác hiện cảnh báo "chưa triển khai". */
  implementedFeatures: PlanFeatureKey[];
}

export async function getPricingCmsEditorData(): Promise<PricingCmsEditorData> {
  const [page, plans, stats, enabledProviders, settings] = await Promise.all([
    loadPricingRow(),
    loadPlans(),
    getHomeStats(),
    getEnabledPlatformProviders(),
    getSystemSettings(),
  ]);
  const live = (page ? parsePricingSections(page.blocks) : null) ?? defaultPricingSections();
  const draft = page?.blocksDraft != null ? parsePricingSections(page.blocksDraft) : null;
  return {
    sections: draft ?? live,
    live,
    hasDraft: draft !== null,
    status: page ? page.status : "NONE",
    updatedAt: page?.updatedAt ?? null,
    seoTitle: page?.seoTitle ?? "",
    seoDescription: page?.seoDescription ?? "",
    plans,
    stats,
    enabledProviders,
    graceDays: settings.graceDays,
    implementedFeatures: [...IMPLEMENTED_PLAN_FEATURES],
  };
}

// ───────────────────────── C4 — trang công khai ─────────────────────────

export type PricingViewer =
  | { kind: "ANON" }
  | { kind: "NO_TENANT" }
  | {
      kind: "TENANT";
      tenantSlug: string;
      currentPlanId: string;
      isFree: boolean;
      status: string;
      /** null với gói Free (không hết hạn). */
      currentPeriodEnd: Date | null;
      hasPendingInvoice: boolean;
    };

export interface PricingCta {
  kind: PricingCtaKey;
  label: string;
  /** null = nhãn chữ (VD "Gói hiện tại", "Tự động áp dụng…"), không phải nút. */
  href: string | null;
}

export interface PricingCardCtas {
  /** Hành động chính (một nút chính mỗi thẻ). */
  primary: PricingCta | null;
  /** Hành động phụ (chỉ thẻ gói hiện tại trả phí: "Gia hạn"). */
  secondary: PricingCta | null;
}

export interface PricingPlanCard {
  /** Mục CMS (gói mới chưa cấu hình → mục mặc định). */
  item: PricingPlanCardItem;
  auto: boolean;
  plan: PricingPlanInfo;
  /** Gói ghép cặp chu kỳ (VD gói năm) — đang bật; null nếu không ghép. */
  altPlan: PricingPlanInfo | null;
  /** % tiết kiệm của `altPlan` so với `plan` (số nguyên, tính từ giá thật); null nếu không tiết kiệm. */
  savingsPercent: number | null;
  isCurrent: boolean;
  isAltCurrent: boolean;
  ctas: PricingCardCtas;
  altCtas: PricingCardCtas | null;
}

export interface PricingStatItem {
  key: keyof HomeStats;
  label: string;
  value: number;
}

export interface PricingPageData {
  /** Đã parse + thay biến `{brand}`/`{graceDays}`; giữ đủ 9 section (UI bỏ `visible:false` và section rỗng). */
  sections: PricingSection[];
  /** Thẻ gói đã ghép: bỏ mục ẩn/gói tắt, nối gói đang bật chưa cấu hình (cuối), kèm CTA theo người xem. */
  cards: PricingPlanCard[];
  /** Gói đang bật (Free trước, giá tăng dần) — cột bảng so sánh. */
  plans: PricingPlanInfo[];
  /** Ô số liệu được bật trong CMS và có giá trị > 0 (rỗng → ẩn section). */
  stats: PricingStatItem[];
  enabledProviders: PaymentProviderId[];
  graceDays: number;
  brandName: string;
  implementedFeatures: PlanFeatureKey[];
  viewer: PricingViewer;
  /** true = đang xem bản nháp (chỉ SYSTEM_ADMIN) — UI hiện dải báo + `robots: noindex`. */
  isPreview: boolean;
  /** CTA cuối trang theo người xem (nhãn: `ctaFinal.buttonLabel` nếu có, không thì theo trạng thái). */
  finalCta: PricingCta;
  /** `CmsPage.seoTitle` — chỉ khi dòng đã PUBLISHED; trống → null (route dùng tiêu đề mặc định). Chưa ghép thương hiệu. */
  seoTitle: string | null;
  /** `CmsPage.seoDescription` — cùng quy tắc với `seoTitle`. */
  seoDescription: string | null;
}

async function loadViewer(userId: string): Promise<PricingViewer> {
  const prisma = getPrismaClient();
  // ADR-022: chỉ gian hàng người xem SỞ HỮU (Tenant.ownerId @unique) — STAFF không quản lý được gói.
  const tenant = await prisma.tenant.findUnique({
    where: { ownerId: userId },
    select: { id: true, slug: true, subscription: { select: { planId: true, status: true, currentPeriodEnd: true, plan: { select: { isFree: true } } } } },
  });
  if (!tenant?.subscription) return { kind: "NO_TENANT" };
  const pending = await prisma.subscriptionInvoice.count({ where: { tenantId: tenant.id, status: "PENDING", dueAt: { gt: new Date() } } });
  const sub = tenant.subscription;
  return {
    kind: "TENANT",
    tenantSlug: tenant.slug,
    currentPlanId: sub.planId,
    isFree: sub.plan.isFree,
    status: sub.status,
    currentPeriodEnd: sub.plan.isFree ? null : sub.currentPeriodEnd,
    hasPendingInvoice: pending > 0,
  };
}

function plansDataOf(sections: readonly PricingSection[]): PricingSectionData<"plans"> | undefined {
  for (const section of sections) if (section.type === "plans") return section.data;
  return undefined;
}

function statsDataOf(sections: readonly PricingSection[]): PricingSectionData<"stats"> | undefined {
  for (const section of sections) if (section.type === "stats") return section.data;
  return undefined;
}

function ctaFinalDataOf(sections: readonly PricingSection[]): PricingSectionData<"ctaFinal"> | undefined {
  for (const section of sections) if (section.type === "ctaFinal") return section.data;
  return undefined;
}

/** Nhãn nút: `{brand}`/`{graceDays}` đã thay ở `applyPricingTemplateDeep`; ở đây chỉ còn `{plan}`. */
function label(labels: PricingCtaLabels, key: PricingCtaKey, planName: string, override?: string): string {
  return (override ?? labels[key]).replace(/\{plan\}/g, planName);
}

/** Đích CTA theo trạng thái người xem (đề xuất §2.3). Code quyết đích, CMS quyết chữ. */
function computeCtas(plan: PricingPlanInfo, viewer: PricingViewer, plansById: Map<string, PricingPlanInfo>, labels: PricingCtaLabels, override?: string): PricingCardCtas {
  const make = (kind: PricingCtaKey, href: string | null, useOverride = true): PricingCta => ({
    kind,
    href,
    label: label(labels, kind, plan.name, useOverride && href ? override : undefined),
  });
  if (viewer.kind === "ANON") {
    return { primary: plan.isFree ? make("signup", "/register") : make("choosePlan", `/register?next=${encodeURIComponent("/studio")}`), secondary: null };
  }
  if (viewer.kind === "NO_TENANT") {
    return { primary: plan.isFree ? make("openStore", "/studio") : make("openStoreFirst", "/studio"), secondary: null };
  }
  const billing = `/studio/${encodeURIComponent(viewer.tenantSlug)}/billing`;
  const isCurrent = viewer.currentPlanId === plan.id;
  if (plan.isFree) {
    // Billing không cho chọn Free: đang Free → "Gói hiện tại"; đang trả phí → dòng chữ tự áp dụng khi hết hạn.
    return { primary: isCurrent || viewer.isFree ? make("current", null, false) : make("freeFallback", null, false), secondary: null };
  }
  if (viewer.hasPendingInvoice) {
    return { primary: isCurrent ? make("current", null, false) : make("pendingInvoice", billing), secondary: isCurrent ? make("pendingInvoice", billing, false) : null };
  }
  const withPlan = `${billing}?plan=${encodeURIComponent(plan.id)}`;
  if (isCurrent) return { primary: make("current", null, false), secondary: make("renew", withPlan, false) };
  const currentPlan = plansById.get(viewer.currentPlanId);
  const isUpgrade = viewer.isFree || !currentPlan || plan.priceVnd >= currentPlan.priceVnd;
  return { primary: make(isUpgrade ? "upgrade" : "switch", withPlan), secondary: null };
}

function finalCtaFor(viewer: PricingViewer, labels: PricingCtaLabels, buttonLabel: string | undefined): PricingCta {
  const base: PricingCta =
    viewer.kind === "ANON"
      ? { kind: "signup", href: "/register", label: labels.signup }
      : viewer.kind === "NO_TENANT"
        ? { kind: "openStore", href: "/studio", label: labels.openStore }
        : { kind: viewer.isFree ? "upgrade" : "renew", href: `/studio/${encodeURIComponent(viewer.tenantSlug)}/billing`, label: viewer.isFree ? labels.upgrade : labels.renew };
  // `{plan}` không có nghĩa ở CTA cuối trang → bỏ biến.
  return { ...base, label: (buttonLabel ?? base.label).replace(/\s*\{plan\}/g, "").trim() || base.label };
}

/** ADR-041 A3: dòng "tính năng gói" chỉ hiện khi cờ đã triển khai + chặn theo gói (`IMPLEMENTED_PLAN_FEATURES`). */
function withoutUnimplementedFeatureRows(sections: PricingSection[]): PricingSection[] {
  return sections.map((section) =>
    section.type === "comparison"
      ? {
          ...section,
          data: {
            ...section.data,
            groups: section.data.groups.map((group) => ({
              ...group,
              rows: group.rows.filter((row) => row.kind !== "feature" || IMPLEMENTED_PLAN_FEATURES.includes(row.featureKey)),
            })),
          },
        }
      : section,
  );
}

/**
 * C4 + C6. `preview: true` chỉ có hiệu lực khi người xem là SYSTEM_ADMIN (kiểm ở server, không tin query string):
 * đọc `blocksDraft ?? blocks`, ép `viewer` về ANON để admin thấy giao diện khách.
 */
export async function getPricingPageData(options: { preview?: boolean } = {}): Promise<PricingPageData> {
  const user = await getCurrentUser();
  const isPreview = options.preview === true && user?.role === "SYSTEM_ADMIN";

  const [page, plans, homeStats, enabledProviders, settings, brand, viewer] = await Promise.all([
    loadPricingRow(),
    loadPlans({ isActive: true }),
    getHomeStats(),
    getEnabledPlatformProviders(),
    getSystemSettings(),
    getEffectiveBrand(),
    isPreview || !user ? Promise.resolve<PricingViewer>({ kind: "ANON" }) : loadViewer(user.userId),
  ]);

  const source = isPreview ? (page?.blocksDraft ?? page?.blocks) : page?.status === "PUBLISHED" ? page.blocks : null;
  const vars = { brand: brand.name, graceDays: settings.graceDays };
  const sections = withoutUnimplementedFeatureRows(applyPricingTemplateDeep(parsePricingSections(source) ?? defaultPricingSections(), vars));

  // parsePricingSections luôn trả đủ 9 section → luôn có section `plans`.
  const plansData = plansDataOf(sections) ?? plansDataOf(defaultPricingSections());
  const labels = plansData?.ctaLabels ?? ({} as PricingCtaLabels);
  const items = plansData?.items ?? [];
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));

  const cards: PricingPlanCard[] = resolvePricingPlanSlots(
    items,
    plans.map((plan) => plan.id),
  ).flatMap(({ item, auto }) => {
    const plan = plansById.get(item.planId);
    if (!plan) return [];
    const altPlan = item.altPlanId ? (plansById.get(item.altPlanId) ?? null) : null;
    const currentPlanId = viewer.kind === "TENANT" ? viewer.currentPlanId : null;
    return [
      {
        item,
        auto,
        plan,
        altPlan,
        savingsPercent: altPlan ? computeCycleSavingsPercent(plan, altPlan) : null,
        isCurrent: currentPlanId === plan.id,
        isAltCurrent: altPlan !== null && currentPlanId === altPlan.id,
        ctas: computeCtas(plan, viewer, plansById, labels, item.ctaLabel),
        altCtas: altPlan ? computeCtas(altPlan, viewer, plansById, labels, item.ctaLabel) : null,
      },
    ];
  });

  const stats: PricingStatItem[] = (statsDataOf(sections)?.items ?? []).flatMap((entry) =>
    entry.visible && homeStats[entry.key] > 0 ? [{ key: entry.key, label: entry.label, value: homeStats[entry.key] }] : [],
  );

  const finalCta = finalCtaFor(viewer, labels, ctaFinalDataOf(sections)?.buttonLabel);

  return {
    sections,
    cards,
    plans,
    stats,
    enabledProviders,
    graceDays: settings.graceDays,
    brandName: brand.name,
    implementedFeatures: [...IMPLEMENTED_PLAN_FEATURES],
    viewer,
    isPreview,
    finalCta,
    // SEO là cột riêng (không có bản nháp) → chỉ lấy khi dòng đã PUBLISHED, kể cả lúc xem trước.
    seoTitle: page?.status === "PUBLISHED" ? blankToNull(page.seoTitle) : null,
    seoDescription: page?.status === "PUBLISHED" ? blankToNull(page.seoDescription) : null,
  };
}
