import { cache } from "react";
import type { Metadata } from "next";
import { getEnv } from "@gieochu/config";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { PricingSection } from "@gieochu/core/pricing-sections";
import { getPricingPageData, type PricingCardCtas } from "../../lib/pricing-cms";
import { ShopEmptyState } from "../_ui/shop-cta";
import {
  PricingComparison,
  PricingCtaFinal,
  PricingFaq,
  PricingHero,
  PricingPaymentMethods,
  PricingPreviewBanner,
  PricingPriceNote,
  PricingStats,
  PricingWhyUs,
} from "../_ui/pricing/pricing-blocks";
import { PricingPlans } from "../_ui/pricing/pricing-plans";

/**
 * Trang Bảng giá `/pricing` (ADR-041 A GĐ2; đề xuất Phong §6). Mọi chữ đọc từ CMS slug `pricing` (`getPricingPageData`, đã
 * thay `{brand}`/`{graceDays}`; chưa xuất bản → cấu hình mặc định), giá/hạn mức từ `Plan`, CTA theo người xem tính ở server.
 * Section `visible` render đúng thứ tự CMS; section rỗng tự ẩn. `?xem-truoc=nhap`: chỉ SYSTEM_ADMIN thấy bản nháp (kiểm ở
 * loader) → dải "Đang xem bản nháp"; URL có tham số này luôn `noindex`.
 */

const PREVIEW_PARAM = "xem-truoc";
const PREVIEW_VALUE = "nhap";
const PATH = "/pricing";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type SectionOf<T extends PricingSection["type"]> = Extract<PricingSection, { type: T }>;

function wantsPreview(params: Record<string, string | string[] | undefined>): boolean {
  return params[PREVIEW_PARAM] === PREVIEW_VALUE;
}

/** Một lần đọc dữ liệu cho cả `generateMetadata` và trang trong cùng request. */
const loadPricing = cache((preview: boolean) => getPricingPageData({ preview }));

function findSection<T extends PricingSection["type"]>(sections: readonly PricingSection[], type: T): SectionOf<T> | undefined {
  return sections.find((section): section is SectionOf<T> => section.type === type);
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const preview = wantsPreview(await searchParams);
  const data = await loadPricing(preview);
  const hero = findSection(data.sections, "hero");
  return {
    // SEO CMS (đã xuất bản, không rỗng) ưu tiên; không có → mặc định theo hero + tên thương hiệu (cùng mẫu `/cua-hang`).
    title: data.seoTitle ?? `Bảng giá | ${data.brandName}`,
    description: data.seoDescription ?? hero?.data.subtitle,
    alternates: { canonical: `${getEnv().APP_URL.replace(/\/+$/, "")}${PATH}` },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const data = await loadPricing(wantsPreview(await searchParams));
  const visible = data.sections.filter((section) => section.visible);
  const hasHero = visible.some((section) => section.type === "hero");

  // CTA đầu cột bảng so sánh = CTA của thẻ gói tương ứng (gói chính + gói ghép cặp).
  const ctasByPlan = new Map<string, PricingCardCtas>();
  for (const card of data.cards) {
    ctasByPlan.set(card.plan.id, card.ctas);
    if (card.altPlan && card.altCtas) ctasByPlan.set(card.altPlan.id, card.altCtas);
  }
  const plansData = findSection(data.sections, "plans")?.data;
  const viewer = data.viewer;
  const currentPlanId = viewer.kind === "TENANT" ? viewer.currentPlanId : null;
  const currentPeriodEndLabel =
    viewer.kind === "TENANT" && viewer.currentPeriodEnd ? viewer.currentPeriodEnd.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE }) : null;

  return (
    <>
      {data.isPreview ? <PricingPreviewBanner /> : null}
      {hasHero ? null : (
        // Hero bị ẩn trong CMS → vẫn giữ một H1 duy nhất cho trang.
        <h1 className="sr-only">Bảng giá</h1>
      )}

      {visible.map((section) => {
        switch (section.type) {
          case "hero":
            return <PricingHero key={section.id} data={section.data} />;
          case "plans":
            return data.cards.length > 0 ? (
              <PricingPlans key={section.id} data={section.data} cards={data.cards} currentPeriodEndLabel={currentPeriodEndLabel} />
            ) : (
              <ShopEmptyState
                key={section.id}
                title="Bảng giá đang được cập nhật"
                description="Hiện chưa có gói dịch vụ nào đang mở bán. Bạn vui lòng quay lại sau."
                cta={null}
                secondary={{ label: "Về trang chủ", href: "/" }}
              />
            );
          case "priceNote":
            return data.cards.length > 0 ? <PricingPriceNote key={section.id} data={section.data} /> : null;
          case "stats":
            return <PricingStats key={section.id} title={section.data.title} items={data.stats} />;
          case "comparison":
            return (
              <PricingComparison
                key={section.id}
                data={section.data}
                plans={data.plans}
                ctasByPlan={ctasByPlan}
                currentPlanId={currentPlanId}
                currentLabel={plansData?.ctaLabels.current ?? ""}
              />
            );
          case "whyUs":
            return <PricingWhyUs key={section.id} data={section.data} />;
          case "faq":
            return <PricingFaq key={section.id} data={section.data} />;
          case "ctaFinal":
            return <PricingCtaFinal key={section.id} data={section.data} cta={data.finalCta} />;
          case "paymentMethods":
            return <PricingPaymentMethods key={section.id} data={section.data} providers={data.enabledProviders} />;
          default:
            return null;
        }
      })}
    </>
  );
}
