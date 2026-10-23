import { z } from "zod";
import { PLAN_FEATURE_KEYS, type PlanFeatureKey } from "../billing/feature-gate";
import { PLAN_LIMIT_FIELD_LABELS, PLAN_LIMIT_FIELDS, type PlanLimitField } from "../billing/plan-limits";
import { HOME_STAT_DEFAULT_LABELS, HOME_STAT_KEYS, type HomeStatKey } from "./home-sections";
import { cmsSeoSchema, SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, type CmsSeoInput } from "./seo";

/**
 * ADR-041 A — cấu hình trang Bảng giá `/pricing`, lưu ở `CmsPage.slug = "pricing"` (`blocks` = live, `blocksDraft` =
 * nháp). Cùng mô hình `shop-sections.ts`: mảng có thứ tự `{ id, type, visible, data }`, mỗi `type` tối đa 1 lần.
 * CMS chỉ lưu chữ marketing + cấu hình hiển thị — tên/giá/chu kỳ/hạn mức/cờ tính năng LUÔN đọc từ `Plan`, số liệu đọc
 * thật (`getHomeStats`), danh sách cổng thanh toán đọc `getEnabledPlatformProviders`.
 *
 * - Lúc LƯU: `pricingSectionsSchema` (chặt) + kiểm tra phía server với danh sách gói thật (`validatePricingPlanRefs`).
 * - Lúc ĐỌC: `parsePricingSections` (phòng thủ — field hỏng về mặc định, mục hỏng bị bỏ, section thiếu thêm ẩn).
 *
 * Biến thay thế lúc render (chỉ 2 biến, không phải template engine): `{brand}` (tên nền tảng, ADR-032) và
 * `{graceDays}` (số ngày ân hạn, `getSystemSettings`). Nhãn nút gói thêm `{plan}` (tên gói). Không chứa chuỗi thương
 * hiệu. Client component dùng qua subpath `@gieochu/core/pricing-sections`.
 */

// ───────────── Giới hạn ─────────────

export const PRICING_ID_MAX = 64;
export const PRICING_EYEBROW_MAX = 60;
export const PRICING_TITLE_MAX = 120;
export const PRICING_SUBTITLE_MAX = 240;
export const PRICING_BADGE_MAX = 40;
export const PRICING_DESCRIPTION_MAX = 300;
export const PRICING_CTA_LABEL_MAX = 40;
export const PRICING_PLAN_BADGE_MAX = 30;
export const PRICING_TAGLINE_MAX = 120;
export const PRICING_NOTE_MAX = 120;
export const PRICING_BENEFIT_MAX = 100;
export const PRICING_BENEFITS_MAX = 8;
export const PRICING_PLAN_ITEMS_MAX = 8;
export const PRICING_PRICE_NOTE_LINE_MAX = 200;
export const PRICING_PRICE_NOTE_LINES_MIN = 1;
export const PRICING_PRICE_NOTE_LINES_MAX = 4;
export const PRICING_STAT_LABEL_MAX = 60;
export const PRICING_COMPARISON_GROUPS_MAX = 6;
export const PRICING_COMPARISON_ROWS_MAX = 15;
export const PRICING_COMPARISON_GROUP_TITLE_MAX = 80;
export const PRICING_ROW_LABEL_MAX = 80;
export const PRICING_ROW_HINT_MAX = 160;
export const PRICING_CELL_TEXT_MAX = 60;
export const PRICING_CELLS_MAX = 16;
export const PRICING_WHY_US_MIN = 1;
export const PRICING_WHY_US_MAX = 6;

// ───────────── SEO (cột `CmsPage.seoTitle/seoDescription`, không thuộc `blocks`) ─────────────

// ADR-050: dùng bộ giới hạn SEO chung (`./seo`) — giữ tên cũ để không đổi nơi gọi, giá trị không đổi (120/320).
export const PRICING_SEO_TITLE_MAX = SEO_TITLE_MAX;
export const PRICING_SEO_DESCRIPTION_MAX = SEO_DESCRIPTION_MAX;

/** SEO trang Bảng giá: trim, để trống = dùng mặc định của route (lưu `null`). */
export const pricingSeoSchema = cmsSeoSchema;
export type PricingSeoInput = CmsSeoInput;
export const PRICING_WHY_US_TITLE_MAX = 80;
export const PRICING_WHY_US_DESCRIPTION_MAX = 240;
export const PRICING_FAQ_MAX = 20;
export const PRICING_FAQ_QUESTION_MAX = 200;
export const PRICING_FAQ_ANSWER_MAX = 1500;
export const PRICING_CYCLE_LABEL_MAX = 30;
export const PRICING_SAVINGS_TEMPLATE_MAX = 60;
export const PRICING_PAYMENT_LABEL_MAX = 60;

export const PRICING_SECTION_TYPES = [
  "hero",
  "plans",
  "priceNote",
  "stats",
  "comparison",
  "whyUs",
  "faq",
  "ctaFinal",
  "paymentMethods",
] as const;
export type PricingSectionType = (typeof PRICING_SECTION_TYPES)[number];

export const PRICING_SECTION_LABELS: Record<PricingSectionType, string> = {
  hero: "Hero",
  plans: "Thẻ gói",
  priceNote: "Ghi chú giá",
  stats: "Số liệu thật",
  comparison: "Bảng so sánh",
  whyUs: "Vì sao chọn",
  faq: "Câu hỏi thường gặp",
  ctaFinal: "Kêu gọi cuối trang",
  paymentMethods: "Phương thức thanh toán",
};

/** Khoá nhãn nút theo trạng thái người xem (code quyết đích đến, CMS chỉ quyết chữ). `{plan}` = tên gói. */
export const PRICING_CTA_KEYS = [
  "signup",
  "choosePlan",
  "openStore",
  "openStoreFirst",
  "upgrade",
  "switch",
  "renew",
  "current",
  "pendingInvoice",
  "freeFallback",
] as const;
export type PricingCtaKey = (typeof PRICING_CTA_KEYS)[number];

export const PRICING_CTA_KEY_LABELS: Record<PricingCtaKey, string> = {
  signup: "Khách chưa đăng nhập — thẻ gói Miễn phí",
  choosePlan: "Khách chưa đăng nhập — thẻ gói trả phí",
  openStore: "Đã đăng nhập, chưa có gian hàng — thẻ gói Miễn phí",
  openStoreFirst: "Đã đăng nhập, chưa có gian hàng — thẻ gói trả phí",
  upgrade: "Có gian hàng — gói giá cao hơn",
  switch: "Có gian hàng — gói giá thấp hơn",
  renew: "Gói hiện tại (trả phí) — nút phụ gia hạn",
  current: "Nhãn gói hiện tại",
  pendingInvoice: "Có hoá đơn đang chờ thanh toán",
  freeFallback: "Đang trả phí — dòng chữ trên thẻ gói Miễn phí",
};

/** Danh sách icon cố định cho "Vì sao chọn" (map sang SVG ở UI — ADR §8.5 truyền icon bằng key). */
export const PRICING_WHY_US_ICONS = ["wallet", "shield", "lock", "store", "database", "bolt", "globe", "mail"] as const;
export type PricingWhyUsIcon = (typeof PRICING_WHY_US_ICONS)[number];

export const PRICING_WHY_US_ICON_LABELS: Record<PricingWhyUsIcon, string> = {
  wallet: "Ví tiền",
  shield: "Khiên bảo vệ",
  lock: "Ổ khoá",
  store: "Gian hàng",
  database: "Dữ liệu",
  bolt: "Tia chớp",
  globe: "Địa cầu",
  mail: "Thư",
};

/** Khớp `PaymentProviderId` (`@gieochu/payments`) — core không phụ thuộc payments; apps/web kiểm bằng `satisfies`. */
export const PRICING_PAYMENT_PROVIDER_IDS = ["MANUAL_QR", "SEPAY", "MOMO"] as const;
export type PricingPaymentProviderId = (typeof PRICING_PAYMENT_PROVIDER_IDS)[number];

export const PRICING_ROW_KINDS = ["limit", "feature", "custom"] as const;
export type PricingRowKind = (typeof PRICING_ROW_KINDS)[number];
export const PRICING_CELL_VALUES = ["yes", "no", "text"] as const;
export const PRICING_ROW_FALLBACKS = ["yes", "no", "dash"] as const;

// ───────────── Schema chặt (dùng khi lưu) ─────────────

const requiredText = (max: number) => z.string().trim().min(1, "Không được để trống.").max(max, `Tối đa ${max} ký tự.`);
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max, `Tối đa ${max} ký tự.`).optional());
const idSchema = z.string().trim().min(1, "Thiếu id.").max(PRICING_ID_MAX);

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): boolean {
  return new Set(items.map(key)).size === items.length;
}

const ctaLabelsSchema = z.object(
  Object.fromEntries(PRICING_CTA_KEYS.map((key) => [key, requiredText(PRICING_CTA_LABEL_MAX)])) as Record<
    PricingCtaKey,
    ReturnType<typeof requiredText>
  >,
);

const planCardItemSchema = z
  .object({
    planId: idSchema,
    altPlanId: z.preprocess(blankToUndefined, idSchema.optional()),
    visible: z.boolean(),
    highlighted: z.boolean(),
    badge: optionalText(PRICING_PLAN_BADGE_MAX),
    tagline: optionalText(PRICING_TAGLINE_MAX),
    benefits: z.array(requiredText(PRICING_BENEFIT_MAX)).max(PRICING_BENEFITS_MAX, `Tối đa ${PRICING_BENEFITS_MAX} quyền lợi.`),
    ctaLabel: optionalText(PRICING_CTA_LABEL_MAX),
    note: optionalText(PRICING_NOTE_MAX),
  })
  .refine((item) => item.altPlanId === undefined || item.altPlanId !== item.planId, {
    message: "Gói ghép cặp phải khác gói chính.",
    path: ["altPlanId"],
  });

const cycleToggleSchema = z.object({
  primaryLabel: requiredText(PRICING_CYCLE_LABEL_MAX),
  altLabel: requiredText(PRICING_CYCLE_LABEL_MAX),
  savingsTemplate: requiredText(PRICING_SAVINGS_TEMPLATE_MAX).refine((value) => value.includes("{percent}"), "Phải chứa {percent}."),
});

const plansDataSchema = z
  .object({
    title: optionalText(PRICING_TITLE_MAX),
    subtitle: optionalText(PRICING_SUBTITLE_MAX),
    showAutoLimits: z.boolean(),
    ctaLabels: ctaLabelsSchema,
    cycleToggle: cycleToggleSchema,
    items: z.array(planCardItemSchema).max(PRICING_PLAN_ITEMS_MAX, `Tối đa ${PRICING_PLAN_ITEMS_MAX} thẻ gói.`),
  })
  .superRefine((data, ctx) => {
    if (data.items.filter((item) => item.highlighted).length > 1) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Chỉ được 1 thẻ nổi bật." });
    }
    const used = new Set<string>();
    data.items.forEach((item, index) => {
      for (const [field, id] of [["planId", item.planId], ["altPlanId", item.altPlanId]] as const) {
        if (!id) continue;
        if (used.has(id)) ctx.addIssue({ code: "custom", path: ["items", index, field], message: "Gói đã được dùng ở thẻ khác." });
        used.add(id);
      }
    });
  });

const heroDataSchema = z.object({
  eyebrow: requiredText(PRICING_EYEBROW_MAX),
  title: requiredText(PRICING_TITLE_MAX),
  subtitle: requiredText(PRICING_SUBTITLE_MAX),
  badge: optionalText(PRICING_BADGE_MAX),
});

const priceNoteDataSchema = z.object({
  lines: z
    .array(requiredText(PRICING_PRICE_NOTE_LINE_MAX))
    .min(PRICING_PRICE_NOTE_LINES_MIN, "Cần ít nhất 1 dòng.")
    .max(PRICING_PRICE_NOTE_LINES_MAX, `Tối đa ${PRICING_PRICE_NOTE_LINES_MAX} dòng.`),
});

const statsDataSchema = z.object({
  title: requiredText(PRICING_TITLE_MAX),
  items: z
    .array(z.object({ key: z.enum(HOME_STAT_KEYS), label: requiredText(PRICING_STAT_LABEL_MAX), visible: z.boolean() }))
    .max(HOME_STAT_KEYS.length)
    .refine((items) => uniqueBy(items, (item) => item.key), "Mỗi số liệu chỉ xuất hiện 1 lần."),
});

const rowBase = { id: idSchema, label: requiredText(PRICING_ROW_LABEL_MAX), hint: optionalText(PRICING_ROW_HINT_MAX) };

const cellSchema = z
  .object({ value: z.enum(PRICING_CELL_VALUES), text: optionalText(PRICING_CELL_TEXT_MAX) })
  .refine((cell) => cell.value !== "text" || (cell.text !== undefined && cell.text.length > 0), {
    message: "Ô kiểu chữ cần nội dung.",
    path: ["text"],
  });

const comparisonRowSchema = z.discriminatedUnion("kind", [
  z.object({ ...rowBase, kind: z.literal("limit"), field: z.enum(PLAN_LIMIT_FIELDS) }),
  z.object({ ...rowBase, kind: z.literal("feature"), featureKey: z.enum(PLAN_FEATURE_KEYS as [PlanFeatureKey, ...PlanFeatureKey[]]) }),
  z.object({
    ...rowBase,
    kind: z.literal("custom"),
    cells: z
      .record(idSchema, cellSchema)
      .refine((cells) => Object.keys(cells).length <= PRICING_CELLS_MAX, `Tối đa ${PRICING_CELLS_MAX} ô.`),
    fallback: z.enum(PRICING_ROW_FALLBACKS),
  }),
]);

const comparisonDataSchema = z
  .object({
    title: requiredText(PRICING_TITLE_MAX),
    subtitle: optionalText(PRICING_SUBTITLE_MAX),
    showPlanHeaderCta: z.boolean(),
    groups: z
      .array(
        z.object({
          id: idSchema,
          title: requiredText(PRICING_COMPARISON_GROUP_TITLE_MAX),
          rows: z.array(comparisonRowSchema).max(PRICING_COMPARISON_ROWS_MAX, `Tối đa ${PRICING_COMPARISON_ROWS_MAX} dòng/nhóm.`),
        }),
      )
      .max(PRICING_COMPARISON_GROUPS_MAX, `Tối đa ${PRICING_COMPARISON_GROUPS_MAX} nhóm.`),
  })
  .superRefine((data, ctx) => {
    if (!uniqueBy(data.groups, (group) => group.id)) ctx.addIssue({ code: "custom", path: ["groups"], message: "id nhóm bị trùng." });
    const rowIds = data.groups.flatMap((group) => group.rows.map((row) => row.id));
    if (new Set(rowIds).size !== rowIds.length) ctx.addIssue({ code: "custom", path: ["groups"], message: "id dòng bị trùng." });
  });

const whyUsDataSchema = z.object({
  title: requiredText(PRICING_TITLE_MAX),
  subtitle: optionalText(PRICING_SUBTITLE_MAX),
  items: z
    .array(
      z.object({
        icon: z.enum(PRICING_WHY_US_ICONS),
        title: requiredText(PRICING_WHY_US_TITLE_MAX),
        description: requiredText(PRICING_WHY_US_DESCRIPTION_MAX),
      }),
    )
    .min(PRICING_WHY_US_MIN, `Cần ít nhất ${PRICING_WHY_US_MIN} mục.`)
    .max(PRICING_WHY_US_MAX, `Tối đa ${PRICING_WHY_US_MAX} mục.`),
});

const faqDataSchema = z.object({
  title: requiredText(PRICING_TITLE_MAX),
  items: z
    .array(z.object({ id: idSchema, question: requiredText(PRICING_FAQ_QUESTION_MAX), answer: requiredText(PRICING_FAQ_ANSWER_MAX) }))
    .max(PRICING_FAQ_MAX, `Tối đa ${PRICING_FAQ_MAX} câu hỏi.`)
    .refine((items) => uniqueBy(items, (item) => item.id), "id câu hỏi bị trùng."),
});

const ctaFinalDataSchema = z.object({
  title: requiredText(PRICING_TITLE_MAX),
  description: requiredText(PRICING_DESCRIPTION_MAX),
  buttonLabel: optionalText(PRICING_CTA_LABEL_MAX),
});

const paymentMethodsDataSchema = z.object({
  title: requiredText(PRICING_TITLE_MAX),
  description: optionalText(PRICING_DESCRIPTION_MAX),
  labels: z.object(
    Object.fromEntries(PRICING_PAYMENT_PROVIDER_IDS.map((id) => [id, optionalText(PRICING_PAYMENT_LABEL_MAX)])) as Record<
      PricingPaymentProviderId,
      ReturnType<typeof optionalText>
    >,
  ),
});

const sectionBase = { id: idSchema, visible: z.boolean() };

export const pricingSectionSchema = z.discriminatedUnion(
  "type",
  [
    z.object({ ...sectionBase, type: z.literal("hero"), data: heroDataSchema }),
    z.object({ ...sectionBase, type: z.literal("plans"), data: plansDataSchema }),
    z.object({ ...sectionBase, type: z.literal("priceNote"), data: priceNoteDataSchema }),
    z.object({ ...sectionBase, type: z.literal("stats"), data: statsDataSchema }),
    z.object({ ...sectionBase, type: z.literal("comparison"), data: comparisonDataSchema }),
    z.object({ ...sectionBase, type: z.literal("whyUs"), data: whyUsDataSchema }),
    z.object({ ...sectionBase, type: z.literal("faq"), data: faqDataSchema }),
    z.object({ ...sectionBase, type: z.literal("ctaFinal"), data: ctaFinalDataSchema }),
    z.object({ ...sectionBase, type: z.literal("paymentMethods"), data: paymentMethodsDataSchema }),
  ],
  { error: "Section không hợp lệ hoặc loại section không được hỗ trợ." },
);

export const pricingSectionsSchema = z
  .array(pricingSectionSchema, { error: "Danh sách section phải là một mảng." })
  .min(1, "Cần ít nhất 1 section.")
  .max(PRICING_SECTION_TYPES.length, `Tối đa ${PRICING_SECTION_TYPES.length} section (mỗi loại 1 lần).`)
  .superRefine((sections, ctx) => {
    const seenTypes = new Set<string>();
    const seenIds = new Set<string>();
    sections.forEach((section, index) => {
      if (seenTypes.has(section.type)) ctx.addIssue({ code: "custom", path: [index, "type"], message: "Mỗi loại section chỉ được xuất hiện 1 lần." });
      if (seenIds.has(section.id)) ctx.addIssue({ code: "custom", path: [index, "id"], message: "id section bị trùng." });
      seenTypes.add(section.type);
      seenIds.add(section.id);
    });
  });

export type PricingSection = z.infer<typeof pricingSectionSchema>;
export type PricingSectionData<T extends PricingSectionType> = Extract<PricingSection, { type: T }>["data"];
export type PricingHeroData = PricingSectionData<"hero">;
export type PricingPlansData = PricingSectionData<"plans">;
export type PricingPlanCardItem = PricingPlansData["items"][number];
export type PricingCtaLabels = PricingPlansData["ctaLabels"];
export type PricingPriceNoteData = PricingSectionData<"priceNote">;
export type PricingStatsData = PricingSectionData<"stats">;
export type PricingComparisonData = PricingSectionData<"comparison">;
export type PricingComparisonGroup = PricingComparisonData["groups"][number];
export type PricingComparisonRow = PricingComparisonGroup["rows"][number];
export type PricingComparisonCell = Extract<PricingComparisonRow, { kind: "custom" }>["cells"][string];
export type PricingWhyUsData = PricingSectionData<"whyUs">;
export type PricingFaqData = PricingSectionData<"faq">;
export type PricingCtaFinalData = PricingSectionData<"ctaFinal">;
export type PricingPaymentMethodsData = PricingSectionData<"paymentMethods">;

export function isValidPricingSections(input: unknown): boolean {
  return pricingSectionsSchema.safeParse(input).success;
}

// ───────────── Kiểm tra tham chiếu gói (server, lúc lưu) ─────────────

export interface PricingPlanRef {
  id: string;
  isFree: boolean;
}

export interface PricingSectionIssue {
  sectionId: string;
  field: string;
  message: string;
}

/**
 * Kiểm phần schema không tự biết được: `planId`/`altPlanId` phải là gói đang tồn tại (được phép gói đã tắt — loader bỏ
 * khi render, editor báo "Gói đang tắt"); gói ghép cặp không phải gói Free, gói chính có ghép cặp cũng không phải Free;
 * ô `custom` chỉ chứa `planId` có thật.
 */
export function validatePricingPlanRefs(sections: readonly PricingSection[], plans: readonly PricingPlanRef[]): PricingSectionIssue[] {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const issues: PricingSectionIssue[] = [];
  for (const section of sections) {
    if (section.type === "plans") {
      section.data.items.forEach((item, index) => {
        const plan = byId.get(item.planId);
        if (!plan) issues.push({ sectionId: section.id, field: `items.${index}.planId`, message: "Gói không còn tồn tại." });
        if (item.altPlanId !== undefined) {
          const alt = byId.get(item.altPlanId);
          if (!alt) issues.push({ sectionId: section.id, field: `items.${index}.altPlanId`, message: "Gói ghép cặp không còn tồn tại." });
          else if (alt.isFree || plan?.isFree) {
            issues.push({ sectionId: section.id, field: `items.${index}.altPlanId`, message: "Không ghép cặp chu kỳ cho gói Miễn phí." });
          }
        }
      });
    }
    if (section.type === "comparison") {
      section.data.groups.forEach((group, groupIndex) =>
        group.rows.forEach((row, rowIndex) => {
          if (row.kind !== "custom") return;
          for (const planId of Object.keys(row.cells)) {
            if (!byId.has(planId)) {
              issues.push({
                sectionId: section.id,
                field: `groups.${groupIndex}.rows.${rowIndex}.cells`,
                message: "Ô gắn với gói không còn tồn tại — bỏ ô đó.",
              });
              break;
            }
          }
        }),
      );
    }
  }
  return issues;
}

// ───────────── Gói hiển thị: ghép thẻ CMS với gói đang bật ─────────────

export interface PricingPlanCardSlot {
  /** Mục CMS (gói mới chưa cấu hình → mục mặc định sinh tự động). */
  item: PricingPlanCardItem;
  /** true = gói đang bật nhưng chưa có trong `plans.items[]` → thêm cuối, nội dung mặc định (ADR-041 A1). */
  auto: boolean;
}

/**
 * Quy tắc render (ADR-041 A1): giữ thứ tự `items[]`, bỏ mục `visible:false` và mục có `planId` không còn đang bật;
 * `altPlanId` không còn bật → coi như không ghép; gói đang bật chưa được nhắc tới (kể cả làm `altPlanId`) → thêm cuối,
 * đang hiện. `activePlanIds` theo thứ tự mong muốn cho phần tự thêm (VD giá tăng dần).
 */
export function resolvePricingPlanSlots(items: readonly PricingPlanCardItem[], activePlanIds: readonly string[]): PricingPlanCardSlot[] {
  const active = new Set(activePlanIds);
  const mentioned = new Set<string>();
  for (const item of items) {
    mentioned.add(item.planId);
    if (item.altPlanId) mentioned.add(item.altPlanId);
  }
  const slots: PricingPlanCardSlot[] = [];
  for (const item of items) {
    if (!item.visible || !active.has(item.planId)) continue;
    const altPlanId = item.altPlanId && active.has(item.altPlanId) ? item.altPlanId : undefined;
    slots.push({ item: { ...item, altPlanId }, auto: false });
  }
  for (const planId of activePlanIds) {
    if (mentioned.has(planId)) continue;
    slots.push({ item: defaultPlanCardItem(planId), auto: true });
  }
  return slots;
}

export function defaultPlanCardItem(planId: string): PricingPlanCardItem {
  return { planId, visible: true, highlighted: false, benefits: [] };
}

// ───────────── % tiết kiệm gói năm (tính từ giá thật, số nguyên) ─────────────

export interface PricingCyclePlan {
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
}

function planMonths(plan: PricingCyclePlan): number {
  return plan.interval === "YEAR" ? plan.intervalCount * 12 : plan.intervalCount;
}

/**
 * % tiết kiệm của gói ghép cặp so với mua gói chính lặp lại cùng số tháng:
 * `floor((giá chính × tháng phụ − giá phụ × tháng chính) × 100 / (giá chính × tháng phụ))`. Chỉ số nguyên (không float).
 * Không tiết kiệm / dữ liệu không hợp lệ → null (UI ẩn nhãn).
 */
export function computeCycleSavingsPercent(primary: PricingCyclePlan, alt: PricingCyclePlan): number | null {
  const primaryMonths = planMonths(primary);
  const altMonths = planMonths(alt);
  if (
    !Number.isInteger(primary.priceVnd) ||
    !Number.isInteger(alt.priceVnd) ||
    primary.priceVnd <= 0 ||
    alt.priceVnd < 0 ||
    primaryMonths <= 0 ||
    altMonths <= 0
  ) {
    return null;
  }
  const baseline = primary.priceVnd * altMonths;
  const diff = baseline - alt.priceVnd * primaryMonths;
  if (diff <= 0) return null;
  const percent = Math.floor((diff * 100) / baseline);
  return percent > 0 ? percent : null;
}

// ───────────── Biến thay thế ─────────────

export interface PricingTemplateVars {
  brand: string;
  graceDays: number;
  plan?: string;
  percent?: number;
}

/** Thay `{brand}`, `{graceDays}`, `{plan}`, `{percent}` (biến không có giá trị → giữ nguyên). */
export function applyPricingTemplate(text: string, vars: PricingTemplateVars): string {
  return text.replace(/\{(brand|graceDays|plan|percent)\}/g, (match, key: string) => {
    const value = (vars as unknown as Record<string, string | number | undefined>)[key];
    return value === undefined ? match : String(value);
  });
}

/** Thay biến trong mọi chuỗi của một giá trị JSON (dùng cho sections trước khi trả về trang công khai). */
export function applyPricingTemplateDeep<T>(value: T, vars: PricingTemplateVars): T {
  if (typeof value === "string") return applyPricingTemplate(value, vars) as T;
  if (Array.isArray(value)) return value.map((item) => applyPricingTemplateDeep(item, vars)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, applyPricingTemplateDeep(item, vars)])) as T;
  }
  return value;
}

// ───────────── Mặc định (tiếng Việt, không chuỗi thương hiệu) ─────────────

const DEFAULT_LIMIT_LABELS: Record<PlanLimitField, string> = PLAN_LIMIT_FIELD_LABELS;

const DEFAULT_CTA_LABELS: PricingCtaLabels = {
  signup: "Bắt đầu miễn phí",
  choosePlan: "Chọn gói {plan}",
  openStore: "Mở gian hàng miễn phí",
  openStoreFirst: "Mở gian hàng trước",
  upgrade: "Nâng cấp lên {plan}",
  switch: "Chuyển sang {plan}",
  renew: "Gia hạn",
  current: "Gói hiện tại",
  pendingInvoice: "Xem hoá đơn đang chờ",
  freeFallback: "Tự động áp dụng khi gói trả phí hết hạn",
};

/**
 * FAQ mẫu — chỉ những ý đã có dữ kiện nghiệp vụ (ADR-021, ADR-041). Các ý chưa có dữ kiện (VAT/hoá đơn, phí/hoa hồng,
 * kênh hỗ trợ) CỐ Ý không có câu mẫu — admin tự thêm khi đã chốt nội dung.
 */
const DEFAULT_FAQ_ITEMS: PricingFaqData["items"] = [
  {
    id: "faq-free",
    question: "Gói Miễn phí có thời hạn không?",
    answer: "Không. Gói Miễn phí dùng không giới hạn thời gian, không cần thẻ thanh toán. Bạn vẫn đăng và bán tài liệu trong giới hạn của gói.",
  },
  {
    id: "faq-trial",
    question: "Có dùng thử gói trả phí không?",
    answer: "Không có dùng thử gói trả phí. Gói Miễn phí dùng không giới hạn thời gian để bạn bắt đầu bán trước, nâng cấp khi cần thêm.",
  },
  {
    id: "faq-upgrade",
    question: "Nâng cấp như thế nào?",
    answer: "Vào Studio → Gói dịch vụ, chọn gói và phương thức thanh toán. Thanh toán xong, gói mới có hiệu lực ngay.",
  },
  {
    id: "faq-switch",
    question: "Đổi gói giữa kỳ thì thời gian còn lại tính sao?",
    answer:
      "Gói mới áp dụng ngay khi thanh toán. Thời gian còn lại của kỳ hiện tại được giữ: kỳ mới nối tiếp sau ngày kỳ hiện tại kết thúc. Hệ thống không tính chênh lệch giá.",
  },
  {
    id: "faq-expire",
    question: "Hết hạn mà chưa gia hạn thì sao? Có mất dữ liệu không?",
    answer:
      "Bạn có {graceDays} ngày ân hạn để gia hạn. Sau đó gian hàng tự chuyển về gói Miễn phí; dữ liệu gian hàng không bị xoá.",
  },
  {
    id: "faq-auto-renew",
    question: "Gói có tự động gia hạn không?",
    answer: "Không. Trước khi hết hạn 7 ngày và 1 ngày, bạn nhận email nhắc để chủ động gia hạn.",
  },
  {
    id: "faq-refund",
    question: "Tôi có được hoàn tiền không?",
    answer:
      "Với lần thanh toán gói đầu tiên của gian hàng, bạn được hoàn 100% nếu gửi yêu cầu trong 7 ngày kể từ khi thanh toán (Studio → Gói dịch vụ) và chưa thanh toán thêm hoá đơn gói nào khác. Sau khi hoàn tiền, gian hàng chuyển về gói Miễn phí, dữ liệu được giữ nguyên.",
  },
];

const DEFAULT_DATA: { [T in PricingSectionType]: PricingSectionData<T> } = {
  hero: {
    eyebrow: "Bảng giá minh bạch",
    title: "Mở gian hàng tài liệu miễn phí, nâng cấp khi bạn cần thêm",
    subtitle: "Bắt đầu với gói Miễn phí không giới hạn thời gian. Tiền bán tài liệu chuyển thẳng vào tài khoản của bạn.",
  },
  plans: {
    showAutoLimits: true,
    ctaLabels: DEFAULT_CTA_LABELS,
    cycleToggle: { primaryLabel: "Theo tháng", altLabel: "Theo năm", savingsTemplate: "Tiết kiệm {percent}%" },
    items: [],
  },
  priceNote: {
    lines: [
      "Giá tính bằng VNĐ cho mỗi kỳ thanh toán.",
      "Đổi gói có hiệu lực ngay sau khi thanh toán; kỳ mới nối tiếp kỳ hiện tại, không tính chênh lệch.",
      "Hết hạn mà không gia hạn: sau {graceDays} ngày ân hạn, gian hàng tự chuyển về gói Miễn phí, dữ liệu được giữ nguyên.",
    ],
  },
  stats: {
    title: "Đang diễn ra trên {brand}",
    items: HOME_STAT_KEYS.map((key) => ({ key, label: HOME_STAT_DEFAULT_LABELS[key], visible: true })),
  },
  comparison: {
    title: "So sánh chi tiết các gói",
    showPlanHeaderCta: true,
    groups: [
      {
        id: "cmp-limits",
        title: "Giới hạn sử dụng",
        rows: PLAN_LIMIT_FIELDS.map((field) => ({ id: `cmp-limit-${field}`, kind: "limit" as const, field, label: DEFAULT_LIMIT_LABELS[field] })),
      },
      {
        id: "cmp-selling",
        title: "Bán hàng",
        rows: [
          { id: "cmp-own-store", kind: "custom", label: "Gian hàng riêng với đường dẫn của bạn", cells: {}, fallback: "yes" },
          { id: "cmp-direct-payout", kind: "custom", label: "Nhận tiền trực tiếp vào tài khoản của bạn", cells: {}, fallback: "yes" },
        ],
      },
    ],
  },
  whyUs: {
    title: "Vì sao chọn {brand}",
    items: [
      { icon: "wallet", title: "Không giữ tiền của bạn", description: "Khách thanh toán thẳng vào tài khoản ngân hàng/ví bạn khai báo trong Studio." },
      { icon: "lock", title: "Tệp tài liệu được bảo vệ", description: "Link tải có thời hạn, không lộ đường dẫn gốc của tệp." },
      { icon: "store", title: "Gian hàng mang thương hiệu của bạn", description: "Đường dẫn riêng, logo, màu sắc và trang bán hàng của riêng bạn." },
      { icon: "database", title: "Hạ gói không mất dữ liệu", description: "Hết hạn hoặc hoàn tiền, gian hàng về gói Miễn phí, dữ liệu được giữ nguyên." },
    ],
  },
  faq: { title: "Câu hỏi thường gặp", items: DEFAULT_FAQ_ITEMS },
  ctaFinal: { title: "Sẵn sàng bán tài liệu đầu tiên?", description: "Mở gian hàng trong vài phút, bắt đầu với gói Miễn phí." },
  paymentMethods: { title: "Thanh toán gói bằng", description: "Chọn phương thức khi nâng cấp trong Studio.", labels: {} },
};

/** id mặc định của section theo type (ổn định — editor/React key dùng được). */
export function defaultPricingSectionId(type: PricingSectionType): string {
  return `pricing-${type}`;
}

/** Bản sao sâu `data` mặc định của một loại section. */
export function defaultPricingSectionData<T extends PricingSectionType>(type: T): PricingSectionData<T> {
  return structuredClone(DEFAULT_DATA[type]) as unknown as PricingSectionData<T>;
}

function defaultSection(type: PricingSectionType, visible: boolean, id = defaultPricingSectionId(type)): PricingSection {
  return { id, type, visible, data: defaultPricingSectionData(type) } as PricingSection;
}

/** Cấu hình mặc định đủ 9 section theo thứ tự đề xuất, tất cả hiện — luôn trả bản sao mới. */
export function defaultPricingSections(): PricingSection[] {
  return PRICING_SECTION_TYPES.map((type) => defaultSection(type, true));
}

// ───────────── Parse phòng thủ ─────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Giá trị qua được `schema` → giá trị đã parse; không → `fallback`. */
function pick<S extends z.ZodType>(schema: S, value: unknown, fallback: z.infer<S>): z.infer<S> {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

/** Giữ phần tử hợp lệ của mảng (bỏ phần tử hỏng), cắt `max`. Không phải mảng → `fallback`. */
function pickArray<S extends z.ZodType>(schema: S, value: unknown, max: number, fallback: z.infer<S>[]): z.infer<S>[] {
  if (!Array.isArray(value)) return fallback;
  const out: z.infer<S>[] = [];
  for (const item of value) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    if (out.length >= max) break;
  }
  return out;
}

/** Lọc trùng theo khoá, giữ lần đầu. */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function normalizePlansData(data: Record<string, unknown>): PricingPlansData {
  const d = DEFAULT_DATA.plans;
  const labels = asRecord(data.ctaLabels);
  const ctaLabels = Object.fromEntries(
    PRICING_CTA_KEYS.map((key) => [key, pick(requiredText(PRICING_CTA_LABEL_MAX), labels[key], d.ctaLabels[key])]),
  ) as PricingCtaLabels;
  // Mục hỏng bị bỏ; gói trùng (chính hoặc ghép cặp) giữ lần đầu; chỉ giữ thẻ nổi bật đầu tiên.
  const used = new Set<string>();
  let highlighted = false;
  const items: PricingPlanCardItem[] = [];
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    const parsed = planCardItemSchema.safeParse(raw);
    if (!parsed.success || used.has(parsed.data.planId)) continue;
    const item: PricingPlanCardItem = { ...parsed.data };
    used.add(item.planId);
    if (item.altPlanId !== undefined) {
      if (used.has(item.altPlanId)) item.altPlanId = undefined;
      else used.add(item.altPlanId);
    }
    if (item.highlighted) {
      if (highlighted) item.highlighted = false;
      highlighted = true;
    }
    items.push(item);
    if (items.length >= PRICING_PLAN_ITEMS_MAX) break;
  }
  return {
    title: pick(optionalText(PRICING_TITLE_MAX), data.title, undefined),
    subtitle: pick(optionalText(PRICING_SUBTITLE_MAX), data.subtitle, undefined),
    showAutoLimits: typeof data.showAutoLimits === "boolean" ? data.showAutoLimits : d.showAutoLimits,
    ctaLabels,
    cycleToggle: pick(cycleToggleSchema, data.cycleToggle, structuredClone(d.cycleToggle)),
    items,
  };
}

function normalizeComparisonData(data: Record<string, unknown>): PricingComparisonData {
  const d = DEFAULT_DATA.comparison;
  const groups: PricingComparisonGroup[] = [];
  const groupIds = new Set<string>();
  const rowIds = new Set<string>();
  for (const rawGroup of Array.isArray(data.groups) ? data.groups : []) {
    const group = asRecord(rawGroup);
    const id = pick(idSchema, group.id, "");
    const title = pick(requiredText(PRICING_COMPARISON_GROUP_TITLE_MAX), group.title, "");
    if (!id || !title || groupIds.has(id)) continue;
    const rows = pickArray(comparisonRowSchema, group.rows, PRICING_COMPARISON_ROWS_MAX, []).filter((row) => {
      if (rowIds.has(row.id)) return false;
      rowIds.add(row.id);
      return true;
    });
    groupIds.add(id);
    groups.push({ id, title, rows });
    if (groups.length >= PRICING_COMPARISON_GROUPS_MAX) break;
  }
  return {
    title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.title),
    subtitle: pick(optionalText(PRICING_SUBTITLE_MAX), data.subtitle, undefined),
    showPlanHeaderCta: typeof data.showPlanHeaderCta === "boolean" ? data.showPlanHeaderCta : d.showPlanHeaderCta,
    groups: Array.isArray(data.groups) ? groups : structuredClone(d.groups),
  };
}

/** Chuẩn hoá `data` của một section: field hợp lệ giữ nguyên, field thiếu/sai → mặc định của field, mục hỏng bị bỏ. */
function normalizeData(type: PricingSectionType, rawData: unknown): PricingSection["data"] {
  const data = asRecord(rawData);
  const d = DEFAULT_DATA;
  switch (type) {
    case "hero":
      return {
        eyebrow: pick(requiredText(PRICING_EYEBROW_MAX), data.eyebrow, d.hero.eyebrow),
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.hero.title),
        subtitle: pick(requiredText(PRICING_SUBTITLE_MAX), data.subtitle, d.hero.subtitle),
        badge: pick(optionalText(PRICING_BADGE_MAX), data.badge, undefined),
      } satisfies PricingHeroData;
    case "plans":
      return normalizePlansData(data);
    case "priceNote": {
      const lines = pickArray(requiredText(PRICING_PRICE_NOTE_LINE_MAX), data.lines, PRICING_PRICE_NOTE_LINES_MAX, []);
      return { lines: lines.length >= PRICING_PRICE_NOTE_LINES_MIN ? lines : [...d.priceNote.lines] } satisfies PricingPriceNoteData;
    }
    case "stats": {
      const items = dedupeBy(pickArray(statsDataSchema.shape.items.element, data.items, HOME_STAT_KEYS.length, []), (item) => item.key);
      return {
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.stats.title),
        items: Array.isArray(data.items) ? items : structuredClone(d.stats.items),
      } satisfies PricingStatsData;
    }
    case "comparison":
      return normalizeComparisonData(data);
    case "whyUs": {
      const items = pickArray(whyUsDataSchema.shape.items.element, data.items, PRICING_WHY_US_MAX, []);
      return {
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.whyUs.title),
        subtitle: pick(optionalText(PRICING_SUBTITLE_MAX), data.subtitle, undefined),
        items: items.length >= PRICING_WHY_US_MIN ? items : structuredClone(d.whyUs.items),
      } satisfies PricingWhyUsData;
    }
    case "faq": {
      const items = dedupeBy(pickArray(faqDataSchema.shape.items.element, data.items, PRICING_FAQ_MAX, []), (item) => item.id);
      return {
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.faq.title),
        items: Array.isArray(data.items) ? items : structuredClone(d.faq.items),
      } satisfies PricingFaqData;
    }
    case "ctaFinal":
      return {
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.ctaFinal.title),
        description: pick(requiredText(PRICING_DESCRIPTION_MAX), data.description, d.ctaFinal.description),
        buttonLabel: pick(optionalText(PRICING_CTA_LABEL_MAX), data.buttonLabel, undefined),
      } satisfies PricingCtaFinalData;
    case "paymentMethods": {
      const labels = asRecord(data.labels);
      return {
        title: pick(requiredText(PRICING_TITLE_MAX), data.title, d.paymentMethods.title),
        description: pick(optionalText(PRICING_DESCRIPTION_MAX), data.description, undefined),
        labels: Object.fromEntries(
          PRICING_PAYMENT_PROVIDER_IDS.flatMap((id) => {
            const value = pick(optionalText(PRICING_PAYMENT_LABEL_MAX), labels[id], undefined);
            return value ? [[id, value]] : [];
          }),
        ),
      } satisfies PricingPaymentMethodsData;
    }
  }
}

/** JSON round-trip: bỏ key `undefined` (trường tuỳ chọn để trống) — dùng trước khi lưu Json. */
export function stripUndefinedPricing<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Đọc `CmsPage.blocks/blocksDraft` của Bảng giá một cách phòng thủ (render + nạp editor; KHÔNG dùng khi lưu):
 *  - Không phải mảng → `null` (caller dùng `defaultPricingSections()`).
 *  - Phần tử không phải object / `type` lạ → bỏ; trùng `type` → giữ phần tử đầu; `id` hỏng/trùng → id mặc định.
 *  - `visible` không phải boolean → `true`; `data` hỏng → chuẩn hoá từng field/mục (mục hỏng trong danh sách bị bỏ).
 *  - Type còn thiếu → thêm cuối từ mặc định ở trạng thái **ẩn**.
 * Kết quả luôn đủ 9 section và hợp lệ theo `pricingSectionsSchema` (không kiểm tham chiếu gói — xem
 * `resolvePricingPlanSlots`).
 */
export function parsePricingSections(input: unknown): PricingSection[] | null {
  if (!Array.isArray(input)) return null;
  const sections: PricingSection[] = [];
  const seenTypes = new Set<PricingSectionType>();
  const seenIds = new Set<string>();

  for (const raw of input) {
    const record = asRecord(raw);
    const type = record.type;
    if (typeof type !== "string" || !(PRICING_SECTION_TYPES as readonly string[]).includes(type)) continue;
    const sectionType = type as PricingSectionType;
    if (seenTypes.has(sectionType)) continue;

    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    let id = rawId.length > 0 && rawId.length <= PRICING_ID_MAX && !seenIds.has(rawId) ? rawId : defaultPricingSectionId(sectionType);
    if (seenIds.has(id)) id = `${defaultPricingSectionId(sectionType)}-${sections.length}`;

    const section = {
      id,
      type: sectionType,
      visible: typeof record.visible === "boolean" ? record.visible : true,
      data: stripUndefinedPricing(normalizeData(sectionType, record.data)),
    } as PricingSection;
    // Lưới an toàn: kết quả chuẩn hoá luôn phải qua schema chặt; không qua → mặc định của section (giữ id/visible).
    const parsed = pricingSectionSchema.safeParse(section);
    sections.push(parsed.success ? stripUndefinedPricing(parsed.data) : defaultSection(sectionType, section.visible, id));
    seenTypes.add(sectionType);
    seenIds.add(id);
  }

  for (const type of PRICING_SECTION_TYPES) {
    if (seenTypes.has(type)) continue;
    let id = defaultPricingSectionId(type);
    if (seenIds.has(id)) id = `${id}-${sections.length}`;
    sections.push(defaultSection(type, false, id));
    seenIds.add(id);
  }
  return sections;
}

/** Parse phòng thủ, không đọc được → mặc định (render `/pricing` khi chưa có/chưa xuất bản dòng `pricing`). */
export function resolvePricingSections(input: unknown): PricingSection[] {
  return parsePricingSections(input) ?? defaultPricingSections();
}

export type { HomeStatKey, PlanFeatureKey, PlanLimitField };

