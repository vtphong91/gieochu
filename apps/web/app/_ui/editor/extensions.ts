import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";

/**
 * Bảng màu chữ preset — theo đúng brandColors, KHÔNG cho chọn tự do (giảm
 * rủi ro nội dung loè loẹt lệch thương hiệu; sanitize-html ở
 * packages/core/src/content/sanitize-html.ts chỉ chấp nhận mã hex 6 ký tự,
 * khớp đúng các giá trị ở đây).
 */
export const TEXT_COLOR_PRESETS = [
  { label: "Mặc định", value: "#12213A" },
  { label: "Xanh dương", value: "#0F3B82" },
  { label: "Cam", value: "#D97706" },
  { label: "Xanh lá", value: "#16A34A" },
  { label: "Đỏ", value: "#DC2626" },
  { label: "Xám", value: "#6B7280" },
] as const;

/**
 * Bộ extension "đầy đủ định dạng văn bản" nhưng CHỦ ĐÍCH KHÔNG đăng ký thứ gì
 * mà toolbar không có nút khai thác — bài học rút ra từ
 * docs/bao-cao-ky-thuat-tiptap-editor-content-creator-2026-09-19.md §2.7/2.9
 * (hệ thống tham khảo đăng ký Color/TextStyle nhưng không có UI, tốn bundle
 * vô ích).
 */
export function buildTiptapExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    }),
    Image.configure({ HTMLAttributes: { class: "max-w-full h-auto rounded-lg" } }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: false }),
  ];
}
