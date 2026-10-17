// Chỉ import subpath client-safe (zod + helper thuần) — không qua barrel "@gieochu/core" (kéo code server-only).
import { PLAN_LIMIT_FIELD_LABELS, type PlanLimitField } from "@gieochu/core/plan-limits";
import {
  PRICING_CTA_KEY_LABELS,
  PRICING_PAYMENT_PROVIDER_IDS,
  pricingSectionsSchema,
  validatePricingPlanRefs,
  type PricingCtaKey,
  type PricingPlanRef,
  type PricingSection,
  type PricingSectionIssue,
  type PricingSectionType,
} from "@gieochu/core/pricing-sections";

/**
 * Kiểm tra phía client trước khi gửi (ADR-041 A, cùng pattern editor Cửa hàng `shop-validation.ts`): chạy đúng schema chặt
 * server dùng (`pricingSectionsSchema`) + kiểm tham chiếu gói (`validatePricingPlanRefs`) với danh sách gói editor đã có,
 * gom lỗi theo section + field (đường dẫn chấm trong `data`, cùng định dạng `issues` server trả về) để hiện dưới từng ô và
 * trong khung tóm tắt. Server vẫn validate lại — đây chỉ để báo lỗi sớm, đúng chỗ.
 */

export interface PricingFieldIssue {
  sectionId: string;
  sectionType: PricingSectionType | null;
  /** Đường dẫn trong `data`, vd `items.0.altPlanId`, `groups.1.rows.2.label`. `""` = lỗi cả section. */
  field: string;
  message: string;
}

/** `sectionId` → `field` → thông báo. */
export type PricingErrorMap = Record<string, Record<string, string>>;

/** id DOM của field (ổn định theo type — mỗi type chỉ xuất hiện 1 lần). */
export function pricingFieldId(type: PricingSectionType, field: string): string {
  return `pricing-${type}-${field.replace(/\./g, "-") || "section"}`;
}

/** Field là danh sách (focus vào nút Thêm của danh sách đó). */
export function isPricingListField(field: string): boolean {
  return /(^|\.)(items|lines|groups|rows|benefits)$/.test(field);
}

const LEAF_LABELS: Record<string, string> = {
  eyebrow: "Dòng nhỏ trên tiêu đề",
  title: "Tiêu đề",
  subtitle: "Mô tả ngắn",
  badge: "Nhãn",
  description: "Mô tả",
  buttonLabel: "Nhãn nút",
  tagline: "Câu giới thiệu",
  note: "Ghi chú dưới giá",
  ctaLabel: "Nhãn nút riêng",
  planId: "Gói",
  altPlanId: "Gói ghép cặp",
  label: "Nhãn",
  hint: "Giải thích",
  question: "Câu hỏi",
  answer: "Câu trả lời",
  icon: "Biểu tượng",
  text: "Nội dung ô",
  cells: "Ô theo gói",
  fallback: "Giá trị mặc định",
  field: "Hạn mức",
  featureKey: "Cờ tính năng",
  primaryLabel: "Nhãn chu kỳ chính",
  altLabel: "Nhãn chu kỳ ghép cặp",
  savingsTemplate: "Nhãn tiết kiệm",
  items: "Danh sách",
  lines: "Các dòng",
  groups: "Các nhóm",
  rows: "Các dòng",
  benefits: "Quyền lợi",
};

const INDEX_LABELS: Record<string, Partial<Record<PricingSectionType, string>> & { default: string }> = {
  items: { default: "Mục", plans: "Thẻ", faq: "Câu hỏi", whyUs: "Lý do", stats: "Số liệu" },
  lines: { default: "Dòng" },
  groups: { default: "Nhóm" },
  rows: { default: "Dòng" },
  benefits: { default: "Quyền lợi" },
};

/** Nhãn dễ đọc của field cho khung tóm tắt, vd "Thẻ 2 · Gói ghép cặp", "Nhóm 1 · Dòng 3 · Nhãn". */
export function describePricingField(type: PricingSectionType | null, field: string, planName?: (planId: string) => string | undefined): string {
  if (!field) return "";
  const parts = field.split(".");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const next = parts[i + 1];
    if (part === "ctaLabels" && next) {
      out.push(`Nhãn nút “${PRICING_CTA_KEY_LABELS[next as PricingCtaKey] ?? next}”`);
      i += 1;
      continue;
    }
    if (part === "cycleToggle") continue;
    if (part === "labels" && next && (PRICING_PAYMENT_PROVIDER_IDS as readonly string[]).includes(next)) {
      out.push(`Nhãn cổng ${next}`);
      i += 1;
      continue;
    }
    if (part === "cells" && next) {
      out.push(`Ô ${planName?.(next) ?? next}`);
      i += 1;
      continue;
    }
    if (next !== undefined && /^\d+$/.test(next) && INDEX_LABELS[part]) {
      const map = INDEX_LABELS[part]!;
      out.push(`${(type && map[type]) || map.default} ${Number(next) + 1}`);
      i += 1;
      continue;
    }
    if (part === "field" && type === "comparison") {
      out.push(LEAF_LABELS.field!);
      continue;
    }
    out.push(LEAF_LABELS[part] ?? (PLAN_LIMIT_FIELD_LABELS as Record<string, string>)[part as PlanLimitField] ?? part);
  }
  return out.join(" · ");
}

/** Trả danh sách lỗi theo thứ tự section trên trang (mỗi field tối đa 1 lỗi). Rỗng = hợp lệ. */
export function validatePricingSections(sections: PricingSection[], plans: readonly PricingPlanRef[]): PricingFieldIssue[] {
  const issues: PricingFieldIssue[] = [];
  const seen = new Set<string>();
  const push = (issue: PricingFieldIssue) => {
    const key = `${issue.sectionId}::${issue.field}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push(issue);
  };

  const parsed = pricingSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
      const section = sections[index];
      if (!section) continue;
      const field = issue.path[1] === "data" ? issue.path.slice(2).map(String).join(".") : "";
      push({ sectionId: section.id, sectionType: section.type, field, message: issue.message });
    }
  } else {
    for (const issue of validatePricingPlanRefs(parsed.data, plans)) push(withType(issue, sections));
  }
  return sortIssues(issues, sections);
}

function withType(issue: PricingSectionIssue, sections: readonly PricingSection[]): PricingFieldIssue {
  return { ...issue, sectionType: sections.find((s) => s.id === issue.sectionId)?.type ?? null };
}

function sortIssues(issues: PricingFieldIssue[], sections: readonly PricingSection[]): PricingFieldIssue[] {
  const order = new Map(sections.map((s, i) => [s.id, i]));
  return issues.sort((a, b) => (order.get(a.sectionId) ?? 99) - (order.get(b.sectionId) ?? 99));
}

/** Gộp lỗi server trả về (đã có cùng định dạng field) với lỗi client, bỏ trùng. */
export function mergeServerIssues(client: PricingFieldIssue[], server: readonly PricingSectionIssue[], sections: readonly PricingSection[]): PricingFieldIssue[] {
  const seen = new Set(client.map((i) => `${i.sectionId}::${i.field}`));
  const extra = server.filter((i) => !seen.has(`${i.sectionId}::${i.field}`)).map((i) => withType(i, sections));
  return sortIssues([...client, ...extra], sections);
}

export function toPricingErrorMap(issues: readonly PricingFieldIssue[]): PricingErrorMap {
  const map: PricingErrorMap = {};
  for (const issue of issues) {
    (map[issue.sectionId] ??= {})[issue.field] ??= issue.message;
  }
  return map;
}
