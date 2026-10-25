import sanitizeHtmlLib from "sanitize-html";
import { isCloudinaryImageUrl } from "../tenant/storefront-sections";
import { cloudinaryDeliveryUrl } from "./cloudinary-url";

/**
 * Whitelist thẻ/thuộc tính khớp CHÍNH XÁC với bộ extension TiptapEditor hỗ
 * trợ (apps/web/app/_ui/editor/extensions.ts) — không mở rộng thêm thẻ nào
 * ngoài những gì editor có thể tự sinh ra, kể cả khi paste nội dung từ nơi
 * khác (Word, web ngoài) vào editor. Đây là lớp phòng thủ THẬT — không tin
 * riêng việc "editor đã kiểm soát UI", vì paste vẫn có thể mang theo
 * `<script>`/`on*` handler/`javascript:` link.
 */
const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "a",
  "img",
  "span",
  "mark",
];

const ALLOWED_ATTRIBUTES: sanitizeHtmlLib.IOptions["allowedAttributes"] = {
  a: ["href"],
  img: ["src", "alt"],
  span: ["style"],
};

/** Chỉ cho phép `color` trong `style`, và chỉ giá trị mã hex 6 ký tự (đúng bảng màu preset của toolbar). */
const ALLOWED_STYLES: sanitizeHtmlLib.IOptions["allowedStyles"] = {
  span: { color: [/^#[0-9a-fA-F]{6}$/] },
};

export interface SanitizeRichTextOptions {
  /**
   * ADR-028 §5: cloud name Cloudinary HỆ THỐNG (đọc ở server từ cấu hình System Admin). `img` chỉ giữ lại khi
   * `src` là `https://res.cloudinary.com/<imageCloudName>/image/upload/...` (khớp CSP `img-src`); ảnh host
   * khác / cloud khác bị loại. `null` (chưa cấu hình Cloudinary) = loại mọi ảnh.
   */
  imageCloudName: string | null;
  /**
   * Chỉ dùng khi RENDER: có giá trị → `src` ảnh được viết lại qua `cloudinaryDeliveryUrl` (f_auto,q_auto,
   * c_limit,w_<N>, N ≤ 1600). Khi LƯU không truyền — DB giữ URL gốc Cloudinary trả về.
   */
  imageWidth?: number;
  /**
   * ADR-054 mục 7 — CHỈ cho nội dung do System Admin soạn (văn bản pháp lý). Có giá trị → link nội bộ (`#…`, `/…`
   * không phải `//`/`/\`, đường dẫn tương đối, hoặc URL tuyệt đối cùng origin `siteOrigin`) giữ cùng tab, không `rel`;
   * link ngoài (`http(s)` khác origin, protocol-relative) → `target="_blank" rel="noopener noreferrer"`; `mailto:` không
   * `target`. `target`/`rel` có sẵn trong HTML luôn bị bỏ và dựng lại. Không truyền = hành vi cũ (bỏ mọi `target`/`rel`).
   */
  trustedLinks?: { siteOrigin: string | null };
}

/** ADR-054 mục 7 — phân loại `href` (đã qua kiểm scheme của sanitize-html) cho chế độ `trustedLinks`. */
export function classifyRichTextLink(href: string, siteOrigin: string | null): "internal" | "external" | "mailto" {
  const value = href.trim();
  let absolute: URL | null = null;
  try {
    absolute = new URL(value);
  } catch {
    absolute = null;
  }
  if (absolute) {
    if (absolute.protocol === "mailto:") return "mailto";
    if (siteOrigin && (absolute.protocol === "https:" || absolute.protocol === "http:") && absolute.origin === siteOrigin) return "internal";
    return "external";
  }
  // Tương đối: `//host` / `/\host` / `\\host` là protocol-relative (trình duyệt coi như host khác) → ngoài.
  if (/^[/\\]{2}/.test(value) || /^\/\\/.test(value)) return "external";
  return "internal";
}

/**
 * Sanitize HTML từ TiptapEditor trước khi lưu DB — gọi ở Server Action, KHÔNG
 * BAO GIỜ tin dữ liệu HTML client gửi lên dù chính editor của mình sinh ra.
 * Dùng chung cho mọi nơi lưu nội dung rich text (mô tả sản phẩm, sau này Blog),
 * và chạy lại khi render (lớp phòng thủ thứ hai).
 */
export function sanitizeRichTextHtml(html: string, options: SanitizeRichTextOptions): string {
  const { imageCloudName, imageWidth, trustedLinks } = options;
  const isAllowedImageSrc = (src: string | undefined): boolean => Boolean(src && imageCloudName && isCloudinaryImageUrl(src, imageCloudName));

  // Lưu ý: `allowedAttributes` của `a` chỉ có `href` nên `target`/`rel` thêm ở transform dưới bị lọc bỏ ở chế độ thường
  // (hành vi hiện có — giữ nguyên ngoài phạm vi ADR-054). Chế độ `trustedLinks` mở `target`/`rel` và tự dựng giá trị.
  const anchorTransform: sanitizeHtmlLib.Transformer = trustedLinks
    ? (_tagName, attribs) => {
        const href = attribs.href;
        const next: sanitizeHtmlLib.Attributes = {};
        if (href) {
          next.href = href;
          if (classifyRichTextLink(href, trustedLinks.siteOrigin) === "external") {
            next.target = "_blank";
            next.rel = "noopener noreferrer";
          }
        }
        return { tagName: "a", attribs: next };
      }
    : sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" });

  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: trustedLinks ? { ...ALLOWED_ATTRIBUTES, a: ["href", "target", "rel"] } : ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    transformTags: {
      a: anchorTransform,
      img: (tagName, attribs) => {
        const src = attribs.src;
        if (!isAllowedImageSrc(src) || !src) return { tagName, attribs: { ...attribs, src: "" } };
        return { tagName, attribs: { ...attribs, src: imageWidth === undefined ? src : cloudinaryDeliveryUrl(src, { width: imageWidth }) } };
      },
    },
    // Ảnh không đạt (src bị xoá trắng ở transformTags) → bỏ hẳn thẻ, không để lại <img> rỗng.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  }).trim();
}
