/**
 * ADR-028 §4 — dựng URL hiển thị ảnh Cloudinary đã tối ưu: chèn transformation cố định
 * `f_auto,q_auto,c_limit,w_<N>` (N ≤ 1600) sau `/image/upload/`. Module thuần, không phụ thuộc Node — client
 * component import được qua subpath `@gieochu/core/cloudinary-url`.
 *
 * - Chỉ áp cho `https://res.cloudinary.com/<cloud>/image/upload/...`; URL khác (R2, host ngoài, `image/fetch`,
 *   video...) trả nguyên.
 * - Idempotent: URL đã có transformation tối ưu của chính hàm này → thay `w_` cũ bằng `w_` mới, không chồng thêm.
 * - Transformation có sẵn khác (vd `c_fill,w_300`) được giữ nguyên; bộ tối ưu nối vào SAU chúng (component cuối
 *   của chuỗi, nơi `f_auto` có hiệu lực), trước segment version `v<số>` và public id.
 */

export const CLOUDINARY_DELIVERY_HOST = "res.cloudinary.com";
export const CLOUDINARY_MAX_DELIVERY_WIDTH = 1600;

const UPLOAD_MARKER = "/image/upload/";
const VERSION_SEGMENT = /^v\d+$/;
/** Bộ tối ưu do hàm này sinh ra — nhận lại để thay thế (idempotent). */
const OPTIMIZE_SEGMENT = /^f_auto,q_auto,c_limit,w_\d+$/;
/**
 * Một component transformation: các cặp `<tham số>_<giá trị>` nối bằng dấu phẩy, tham số thuộc danh sách
 * tham số URL phổ biến của Cloudinary. Danh sách đóng để folder của public id (vd `gieochu`, `tenants`) không bị
 * nhận nhầm là transformation khi URL không có segment version.
 */
const TRANSFORM_PARAM = /^(a|ac|af|ar|b|bo|br|c|co|cs|d|dl|dn|dpr|du|e|eo|f|fl|fn|fps|g|h|if|ki|l|o|p|pg|q|r|so|sp|t|u|vc|vs|w|x|y|z)_[^,/]+$/;

function isTransformationSegment(segment: string): boolean {
  return segment.length > 0 && segment.split(",").every((part) => TRANSFORM_PARAM.test(part));
}

function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return CLOUDINARY_MAX_DELIVERY_WIDTH;
  return Math.min(CLOUDINARY_MAX_DELIVERY_WIDTH, Math.max(1, Math.round(width)));
}

export interface CloudinaryDeliveryOptions {
  /** Cạnh ngang tối đa (px) theo ngữ cảnh hiển thị; bị kẹp về [1, 1600]. */
  width: number;
}

export function cloudinaryDeliveryUrl(secureUrl: string, options: CloudinaryDeliveryOptions): string {
  let url: URL;
  try {
    url = new URL(secureUrl);
  } catch {
    return secureUrl;
  }
  if (url.protocol !== "https:" || url.hostname !== CLOUDINARY_DELIVERY_HOST || url.username || url.password) return secureUrl;

  const markerIndex = url.pathname.indexOf(UPLOAD_MARKER);
  // Pathname phải là `/<cloud>/image/upload/...` — marker nằm ngay sau segment cloud name.
  if (markerIndex <= 0 || url.pathname.slice(1, markerIndex).includes("/")) return secureUrl;

  const prefix = url.pathname.slice(0, markerIndex + UPLOAD_MARKER.length);
  const segments = url.pathname.slice(prefix.length).split("/");

  const transforms: string[] = [];
  let index = 0;
  while (index < segments.length - 1) {
    const segment = segments[index] ?? "";
    if (VERSION_SEGMENT.test(segment) || !isTransformationSegment(segment)) break;
    if (!OPTIMIZE_SEGMENT.test(segment)) transforms.push(segment);
    index += 1;
  }
  const rest = segments.slice(index);
  if (rest.length === 0 || rest.every((segment) => segment === "")) return secureUrl;

  transforms.push(`f_auto,q_auto,c_limit,w_${clampWidth(options.width)}`);
  url.pathname = `${prefix}${[...transforms, ...rest].join("/")}`;
  return url.toString();
}
