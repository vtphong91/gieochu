import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { IconExternalLink, IconMail } from "../admin/_ui/icons";

/**
 * Mảnh link điều hướng dùng chung cho `SiteHeader` (server), `NavDropdown`/`MobileNav` (client) và `SiteFooter` (ADR-050).
 * Không có hook → import được cả hai phía. Quy tắc:
 *  - Nội bộ (`/…`) dùng `<Link>`; `https://`/`mailto:` dùng `<a>`.
 *  - `newTab` → `target="_blank"` + `rel="noopener noreferrer"` + chữ ẩn "(mở trong tab mới)".
 *  - Link ngoài/email có biểu tượng nhỏ cạnh nhãn (trang trí, `aria-hidden`) + chữ ẩn — chỉ báo không chỉ bằng icon.
 */

export interface NavLinkData {
  href: string;
  label: string;
  newTab?: boolean;
  external?: boolean;
}

function isMailto(href: string): boolean {
  return href.toLowerCase().startsWith("mailto:");
}

/** Chữ ẩn đọc cho trình đọc màn hình sau nhãn (rỗng = link nội bộ, cùng tab). */
function srSuffix(link: NavLinkData): string {
  if (link.newTab) return " (mở trong tab mới)";
  if (link.external && isMailto(link.href)) return " (gửi email)";
  if (link.external) return " (trang bên ngoài)";
  return "";
}

/** Nhãn + chỉ báo link ngoài/email/tab mới. `iconClassName` để khớp cỡ chữ của ngữ cảnh. */
export function NavLinkLabel({ link, iconClassName = "h-3.5 w-3.5" }: { link: NavLinkData; iconClassName?: string }) {
  const suffix = srSuffix(link);
  const showIcon = link.external || link.newTab;
  return (
    <>
      <span className="min-w-0 [overflow-wrap:anywhere]">{link.label}</span>
      {showIcon ? (
        isMailto(link.href) ? (
          <IconMail className={`${iconClassName} shrink-0 opacity-70`} />
        ) : (
          <IconExternalLink className={`${iconClassName} shrink-0 opacity-70`} />
        )
      ) : null}
      {suffix ? <span className="sr-only">{suffix}</span> : null}
    </>
  );
}

export function newTabProps(link: { newTab?: boolean }) {
  return link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/** Link điều hướng: tự chọn `<Link>`/`<a>`, thêm `rel` khi mở tab mới. `children` thay nội dung mặc định (`NavLinkLabel`). */
export function NavLinkAnchor({
  link,
  className,
  style,
  current,
  onClick,
  children,
}: {
  link: NavLinkData;
  className?: string;
  style?: CSSProperties;
  current?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const common = {
    className,
    style,
    onClick,
    "aria-current": current ? ("page" as const) : undefined,
    ...newTabProps(link),
  };
  const content = children ?? <NavLinkLabel link={link} />;
  return link.external ? (
    <a href={link.href} {...common}>
      {content}
    </a>
  ) : (
    <Link href={link.href} {...common}>
      {content}
    </Link>
  );
}
