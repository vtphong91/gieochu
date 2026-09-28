import type { StorefrontServicesData } from "@gieochu/core";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { ServiceIcon } from "./icons";
import { CONTAINER, SectionHeading } from "./primitives";

/** Màu icon xoay vòng theo thẻ như mẫu: primary / accent / đỏ. Biến *-text đã bảo đảm ≥ 4.5:1 trên nền trắng. */
const ICON_COLORS = ["var(--sf-primary-text)", "var(--sf-accent-text)", "var(--sf-red)"] as const;

/** 4 mục → 4 cột (không mồ côi 1 thẻ ở hàng 2); còn lại tối đa 3 cột như mẫu. */
function gridCols(count: number): string {
  if (count === 1) return "mx-auto max-w-sm";
  if (count === 2) return "sm:grid-cols-2 mx-auto max-w-3xl";
  if (count === 4) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

export function ServicesSection({ anchorId, data }: { anchorId: string; data: StorefrontServicesData }) {
  const titleId = `${anchorId}-title`;
  return (
    <section id={anchorId} aria-labelledby={titleId} className="bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} subtitle={data.subtitle} />
        <ul className={`mt-12 grid grid-cols-1 gap-6 ${gridCols(data.items.length)}`}>
          {data.items.map((item, index) => (
            <li
              key={`${item.title}-${index}`}
              className="flex flex-col items-center rounded-lg bg-white px-6 py-9 text-center shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04]"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary do tenant upload
                <img src={cloudinaryDeliveryUrl(item.imageUrl, { width: 200 })} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <span aria-hidden="true" className="inline-flex" style={{ color: ICON_COLORS[index % ICON_COLORS.length] }}>
                  <ServiceIcon icon={item.icon} className="h-14 w-14" />
                </span>
              )}
              <h3 className="font-[family-name:var(--font-heading)] mt-5 text-lg leading-snug font-bold [overflow-wrap:anywhere]">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--sf-ink-soft)" }}>
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
