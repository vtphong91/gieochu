import type { CSSProperties } from "react";
import type { StorefrontContactData } from "@gieochu/core";
import { ContactForm } from "./contact-form";
import { IconPaperPlane, SocialIcon, type SocialEntry } from "./icons";
import { CONTAINER, SectionHeading, SfLink, pillClass } from "./primitives";

const CTA_STYLE = {
  background: "linear-gradient(135deg, var(--sf-accent) 0%, var(--sf-cta-end) 100%)",
  color: "var(--sf-on-accent)",
  "--sf-focus": "var(--sf-on-accent)",
} as CSSProperties;

/**
 * Section "Let's work together" của mẫu: trái form liên hệ, phải khối CTA bo góc
 * gradient accent (chữ `--sf-on-accent` đạt ≥ 4.5:1 trên cả dải gradient), nút
 * pill trắng chữ accent, máy bay giấy trắng lớn góc trên phải. `formEnabled=false`
 * → khối CTA chiếm toàn bề ngang. Nút CTA: ctaHref → link mạng xã hội ưu tiên →
 * (nếu có form) nhảy tới form; không có gì thì ẩn nút.
 * ADR-025: link mạng xã hội của tenant (không còn footer tenant) hiện thành hàng icon tròn
 * viền `currentColor` dưới nút CTA — cùng màu chữ `--sf-on-accent` nên đạt tương phản trên gradient.
 */
export function ContactSection({
  anchorId,
  data,
  tenantSlug,
  tenantName,
  fallbackHref,
  socialLinks,
}: {
  anchorId: string;
  data: StorefrontContactData;
  tenantSlug: string;
  tenantName: string;
  /** Link mạng xã hội ưu tiên của tenant (null nếu chưa có). */
  fallbackHref: string | null;
  /** Toàn bộ link mạng xã hội tenant đã cấu hình (rỗng → ẩn hàng icon). */
  socialLinks: SocialEntry[];
}) {
  const titleId = `${anchorId}-title`;
  const formId = `${anchorId}-form`;
  const ctaHref = data.ctaHref ?? fallbackHref ?? (data.formEnabled ? `#${formId}-name` : null);

  return (
    <section id={anchorId} aria-labelledby={titleId} className="bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} />

        <div className={`mt-12 grid gap-8 lg:gap-10 ${data.formEnabled ? "md:grid-cols-2" : ""}`}>
          {data.formEnabled ? (
            <div className="min-w-0">
              <ContactForm tenantSlug={tenantSlug} formTitle={data.formTitle} successMessage={data.successMessage} formId={formId} />
            </div>
          ) : null}

          <div
            className={`relative flex min-w-0 flex-col justify-center overflow-hidden rounded-2xl px-7 py-10 sm:px-10 sm:py-12 ${data.formEnabled ? "" : "md:px-14"}`}
            style={CTA_STYLE}
          >
            <span aria-hidden="true" className="pointer-events-none absolute top-5 right-5 opacity-90 sm:top-7 sm:right-7">
              <IconPaperPlane className="h-14 w-14 sm:h-20 sm:w-20" />
            </span>
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full border-[1.5px] border-current opacity-20" />

            <div className={`relative ${data.formEnabled ? "pr-12 sm:pr-16" : "max-w-2xl pr-16 sm:pr-24"}`}>
              <h3 className="font-[family-name:var(--font-heading)] text-2xl leading-tight font-extrabold text-balance [overflow-wrap:anywhere] sm:text-3xl">
                {data.ctaTitle}
              </h3>
              <p className="mt-4 text-base leading-relaxed whitespace-pre-line sm:text-[17px]">{data.ctaSubtitle}</p>
            </div>
            {ctaHref ? (
              <div className="relative mt-8">
                <SfLink href={ctaHref} className={pillClass("white")}>
                  {data.ctaLabel}
                </SfLink>
              </div>
            ) : null}
            {socialLinks.length > 0 ? (
              <ul className={`relative flex flex-wrap items-center gap-3 ${ctaHref ? "mt-6" : "mt-8"}`} aria-label={`Mạng xã hội của ${tenantName}`}>
                {socialLinks.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${link.label} của ${tenantName} (mở tab mới)`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-current transition-colors duration-200 hover:bg-white hover:text-[color:var(--sf-accent-text)] motion-reduce:transition-none"
                    >
                      <SocialIcon socialKey={link.key} className="h-5 w-5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
