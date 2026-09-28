import type { StorefrontHeroData } from "@gieochu/core";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { IconCheck } from "./icons";
import { CONTAINER, SfLink, initialOf, pillClass } from "./primitives";

/**
 * Hoạ tiết mảnh phía sau ảnh (mẫu): 2 hình thoi primary nhạt, vài chấm accent.
 * Thuần trang trí — aria-hidden.
 */
function GeometricLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 440" fill="none" aria-hidden="true" focusable="false" className={className}>
      <g stroke="var(--sf-primary)" strokeWidth="1.4" strokeOpacity="0.28">
        <path d="M230 8 392 170 230 332 68 170Z" />
        <path d="M150 120 300 270 150 420 0 270Z" strokeOpacity="0.18" />
        <path d="M330 300 392 362 330 424 268 362Z" strokeOpacity="0.22" />
      </g>
      <g fill="var(--sf-accent)" fillOpacity="0.8">
        <circle cx="372" cy="96" r="5" />
        <circle cx="352" cy="72" r="3" />
        <circle cx="28" cy="404" r="4" />
      </g>
      <g fill="var(--sf-primary)" fillOpacity="0.3">
        <circle cx="386" cy="250" r="3" />
        <circle cx="46" cy="60" r="3.5" />
      </g>
    </svg>
  );
}

/**
 * Khung ảnh phải hero. Ưu tiên: ảnh của section (imageUrl) → ảnh bìa trang →
 * logo → monogram chữ cái đầu trên gradient (không dùng ảnh người mẫu giả).
 * Monogram chỉ hiện từ md: trên mobile nó chỉ là trang trí, đẩy nội dung xuống sâu.
 */
function HeroVisual({ name, imageUrl, logoUrl }: { name: string; imageUrl: string | null; logoUrl: string | null }) {
  const hasImage = Boolean(imageUrl || logoUrl);
  return (
    <div className={`relative mx-auto w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] ${hasImage ? "" : "hidden md:block"}`}>
      <GeometricLines className="pointer-events-none absolute -top-10 -right-14 h-[calc(100%+5rem)] w-[calc(100%+7rem)] max-w-none" />
      {/* 2 tam giác accent nhỏ bên trái ảnh (mẫu). */}
      <svg viewBox="0 0 40 60" aria-hidden="true" focusable="false" className="pointer-events-none absolute top-1/3 -left-9 h-12 w-8 sm:-left-12">
        <path d="M4 4 30 17 4 30Z" fill="var(--sf-accent)" fillOpacity="0.85" />
        <path d="M12 38 30 47 12 56Z" fill="var(--sf-accent)" fillOpacity="0.5" />
      </svg>
      {/* Khung viền mảnh bo góc lệch phía sau ảnh. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 translate-x-4 -translate-y-4 rounded-2xl border-2 sm:translate-x-5 sm:-translate-y-5"
        style={{ borderColor: "var(--sf-primary)", opacity: 0.35 }}
      />
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-20px_rgba(15,23,42,0.35)]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary/bucket public, host động
          <img src={cloudinaryDeliveryUrl(imageUrl, { width: 1000 })} alt={`Ảnh của ${name}`} width={360} height={450} className="h-full w-full object-cover" fetchPriority="high" />
        ) : logoUrl ? (
          <div className="flex h-full w-full items-center justify-center p-10" style={{ background: "var(--sf-primary-soft)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- host ảnh động (bucket public do admin cấu hình) */}
            <img src={logoUrl} alt={`Logo ${name}`} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(150deg, var(--sf-primary) 0%, var(--sf-accent) 100%)" }}
          >
            <span className="font-[family-name:var(--font-heading)] text-[8rem] leading-none font-extrabold lg:text-[10rem]" style={{ color: "var(--sf-on-primary)" }}>
              {initialOf(name)}
            </span>
          </div>
        )}
      </div>
      {/* Badge tròn đỏ dấu ✓ đè góc dưới phải — điểm nhấn thị giác, không mang thông tin. */}
      <span
        aria-hidden="true"
        className="absolute -right-5 -bottom-5 flex h-[60px] w-[60px] items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_var(--sf-red)] ring-4 ring-white sm:h-[70px] sm:w-[70px]"
        style={{ background: "var(--sf-red)" }}
      >
        <IconCheck className="h-7 w-7 sm:h-8 sm:w-8" />
      </span>
    </div>
  );
}

/** Tiêu đề dài (tên + câu nhấn) co cỡ chữ để không vỡ khung như tiêu đề 2 từ của mẫu. */
function titleSize(text: string): string {
  if (text.length > 40) return "text-3xl sm:text-4xl lg:text-[44px]";
  if (text.length > 22) return "text-4xl sm:text-5xl lg:text-[52px]";
  return "text-[40px] sm:text-6xl lg:text-[64px]";
}

export function StorefrontHero({
  anchorId,
  data,
  name,
  imageUrl,
  logoUrl,
}: {
  anchorId: string;
  data: StorefrontHeroData;
  name: string;
  /** data.imageUrl ?? ảnh bìa trang (page quyết định). */
  imageUrl: string | null;
  logoUrl: string | null;
}) {
  const titleId = `${anchorId}-title`;
  return (
    <section id={anchorId} aria-labelledby={titleId} className="relative overflow-hidden" style={{ background: "var(--sf-hero-bg)" }}>
      <div className={`${CONTAINER} grid items-center gap-16 py-14 sm:py-20 md:grid-cols-[1.15fr_0.85fr] md:gap-10 lg:py-24`}>
        <div className="min-w-0">
          {data.eyebrow ? (
            <p className="font-[family-name:var(--font-heading)] text-sm font-bold tracking-[0.12em] uppercase" style={{ color: "var(--sf-primary-text)" }}>
              {data.eyebrow}
            </p>
          ) : null}
          <h1
            id={titleId}
            className={`font-[family-name:var(--font-heading)] mt-3 leading-[1.08] font-extrabold tracking-tight text-balance [overflow-wrap:anywhere] ${titleSize(data.title)}`}
          >
            <span className="block" style={{ color: "var(--sf-heading-from)" }}>
              {data.title}
            </span>
            {data.highlight ? (
              <span className={`mt-1 block ${data.highlight.length > data.title.length + 8 ? titleSize(data.highlight) : ""}`}>
                <span className="sf-gradient-text">{data.highlight}</span>
              </span>
            ) : null}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed whitespace-pre-line sm:text-lg" style={{ color: "var(--sf-ink-soft)" }}>
            {data.subtitle}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <SfLink href={data.primaryCta.href} className={pillClass("primary")}>
              {data.primaryCta.label}
            </SfLink>
            <SfLink href={data.secondaryCta.href} className={pillClass("accent")}>
              {data.secondaryCta.label}
            </SfLink>
          </div>
        </div>

        <HeroVisual name={name} imageUrl={imageUrl} logoUrl={logoUrl} />
      </div>
    </section>
  );
}
