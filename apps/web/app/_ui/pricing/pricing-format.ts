import type { ComponentType } from "react";
import type { PricingPaymentProviderId, PricingWhyUsIcon } from "@gieochu/core/pricing-sections";
import { IconBank, IconBolt, IconDatabase, IconGlobe, IconLock, IconMail, IconShield, IconStore, IconWallet } from "../../admin/_ui/icons";
import { formatCount } from "../catalog-parts";

/**
 * Định dạng + bảng ánh xạ dùng chung cho trang Bảng giá (`/pricing`) và editor CMS (`/admin/cms/pricing`) — ADR-041 A.
 * Thuần (không hook, không dữ liệu server) → server component lẫn client component import được.
 */

type IconComponent = ComponentType<{ className?: string }>;

/** Icon "Vì sao chọn" truyền bằng key chuỗi (UI-Design-System §8.5) → SVG chung của `admin/_ui/icons.tsx`. */
const WHY_US_ICONS: Record<PricingWhyUsIcon, IconComponent> = {
  wallet: IconWallet,
  shield: IconShield,
  lock: IconLock,
  store: IconStore,
  database: IconDatabase,
  bolt: IconBolt,
  globe: IconGlobe,
  mail: IconMail,
};

export function pricingWhyUsIcon(key: PricingWhyUsIcon): IconComponent {
  return WHY_US_ICONS[key] ?? IconBolt;
}

/** Tên mặc định của cổng thanh toán nền tảng khi CMS không đặt nhãn riêng (`paymentMethods.labels`). */
const PROVIDER_FALLBACK_LABELS: Record<PricingPaymentProviderId, string> = {
  MANUAL_QR: "Chuyển khoản ngân hàng qua mã QR",
  SEPAY: "Chuyển khoản ngân hàng (tự xác nhận)",
  MOMO: "Ví MoMo",
};

const PROVIDER_ICONS: Record<PricingPaymentProviderId, IconComponent> = {
  MANUAL_QR: IconBank,
  SEPAY: IconBank,
  MOMO: IconWallet,
};

export function pricingProviderLabel(provider: string, override?: string): string {
  return override || PROVIDER_FALLBACK_LABELS[provider as PricingPaymentProviderId] || provider;
}

export function pricingProviderIcon(provider: string): IconComponent {
  return PROVIDER_ICONS[provider as PricingPaymentProviderId] ?? IconWallet;
}

export interface PricingPricePlan {
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  isFree: boolean;
}

/** Giá hiển thị + bản đọc cho trình đọc màn hình: "199.000 ₫" + "/ tháng" ↔ "199.000 đồng mỗi tháng". */
export function describePlanPrice(plan: PricingPricePlan): { free: boolean; amount: string; period: string; spoken: string } {
  if (plan.isFree || plan.priceVnd === 0) return { free: true, amount: "Miễn phí", period: "", spoken: "Miễn phí" };
  const unit = plan.interval === "YEAR" ? "năm" : "tháng";
  const period = plan.intervalCount === 1 ? unit : `${formatCount(plan.intervalCount)} ${unit}`;
  const amount = `${formatCount(plan.priceVnd)} ₫`;
  return { free: false, amount, period: `/ ${period}`, spoken: `${formatCount(plan.priceVnd)} đồng mỗi ${period}` };
}

/**
 * Số liệu nổi bật (cùng quy tắc trang chủ, UI-Design-System §12.2): < 1.000 hiện đúng số; từ 1.000 làm tròn XUỐNG hàng trăm
 * kèm "+" — không bao giờ phóng đại. `spoken` cho trình đọc màn hình ("Hơn 1.200").
 */
export function formatPricingStat(value: number): { visual: string; spoken: string } {
  if (value < 1000) return { visual: formatCount(value), spoken: formatCount(value) };
  const floored = Math.floor(value / 100) * 100;
  return floored === value ? { visual: formatCount(value), spoken: formatCount(value) } : { visual: `${formatCount(floored)}+`, spoken: `Hơn ${formatCount(floored)}` };
}
