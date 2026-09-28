"use client";

import { useId, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { TEXT_COLOR_PRESETS } from "./extensions";
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconBulletList,
  IconCode,
  IconHighlight,
  IconHorizontalRule,
  IconImagePic,
  IconItalic,
  IconLinkChain,
  IconOrderedList,
  IconQuote,
  IconRedo,
  IconSpinner,
  IconStrike,
  IconTextColor,
  IconUnderline,
  IconUndo,
} from "./toolbar-icons";

const INK = "#12213A";
const LINE = "#E5E7EB";
const ACTIVE_BG = "#EFF6FF";
const ACTIVE_FG = "#0F3B82";

function ToolbarButton({
  active,
  expanded,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  /** Chỉ truyền cho nút mở popover — báo trình đọc màn hình popover đang mở/đóng. */
  expanded?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-primary) disabled:cursor-not-allowed disabled:opacity-40"
      style={active ? { background: ACTIVE_BG, color: ACTIVE_FG } : { color: INK }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px shrink-0" style={{ background: LINE }} />;
}

export function TiptapToolbar({
  editor,
  onInsertImage,
  imageBusy = false,
}: {
  editor: Editor | null;
  /** Mở hộp chọn file ảnh (ADR-028). Không truyền → ẩn nút chèn ảnh. */
  onInsertImage?: () => void;
  /** Đang tải ảnh lên — khoá nút chèn ảnh, đổi icon sang vòng tải. */
  imageBusy?: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [altOpen, setAltOpen] = useState(false);
  const [altText, setAltText] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const linkInputId = useId();
  const altInputId = useId();
  // Chọn ảnh (nhấn vào ảnh) không đổi nội dung nên không làm editor render lại — theo dõi riêng bằng useEditorState
  // để hiện nút "Mô tả ảnh" đúng lúc.
  const imageSelected = useEditorState({ editor, selector: (ctx) => ctx.editor?.isActive("image") ?? false }) ?? false;

  if (!editor) return null;

  function openLinkDialog() {
    setLinkUrl(editor!.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (url) {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor!.chain().focus().unsetLink().run();
    }
    setLinkOpen(false);
  }

  function openAltDialog() {
    setAltText((editor!.getAttributes("image").alt as string | undefined) ?? "");
    setAltOpen(true);
  }

  function applyAlt() {
    editor!.chain().focus().updateAttributes("image", { alt: altText.trim() }).run();
    setAltOpen(false);
  }

  const headingValue = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : editor.isActive("heading", { level: 4 })
          ? "4"
          : "0";

  return (
    <div className="relative flex flex-wrap items-center gap-0.5 rounded-t-lg border-b bg-white px-2 py-1.5" style={{ borderColor: LINE }}>
      <select
        aria-label="Kiểu đoạn văn"
        value={headingValue}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run();
        }}
        className="h-8 shrink-0 cursor-pointer rounded-md border bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/30"
        style={{ borderColor: LINE, color: INK }}
      >
        <option value="0">Đoạn văn</option>
        <option value="1">Tiêu đề 1</option>
        <option value="2">Tiêu đề 2</option>
        <option value="3">Tiêu đề 3</option>
        <option value="4">Tiêu đề 4</option>
      </select>

      <Separator />

      <ToolbarButton label="Đậm" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <IconBold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Nghiêng" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <IconItalic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Gạch chân" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <IconUnderline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Gạch ngang" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <IconStrike className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <IconCode className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Đánh dấu" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <IconHighlight className="h-4 w-4" />
      </ToolbarButton>

      {/* Mobile: popover neo theo cả toolbar (left-2) để không tràn mép phải màn hình khi toolbar xuống dòng;
          từ sm trở lên: neo ngay dưới nút (wrapper sm:relative). */}
      <div className="sm:relative">
        <ToolbarButton label="Màu chữ" expanded={colorOpen} onClick={() => setColorOpen((v) => !v)}>
          <IconTextColor className="h-4 w-4" />
        </ToolbarButton>
        {colorOpen ? (
          <div
            role="group"
            aria-label="Chọn màu chữ"
            onKeyDown={(e) => e.key === "Escape" && setColorOpen(false)}
            className="absolute top-full left-2 z-20 mt-1 flex gap-1.5 rounded-lg border bg-white p-2 shadow-lg sm:left-0"
            style={{ borderColor: LINE }}
          >
            {TEXT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                aria-label={`Màu chữ: ${preset.label}`}
                onClick={() => {
                  editor.chain().focus().setColor(preset.value).run();
                  setColorOpen(false);
                }}
                className="h-7 w-7 cursor-pointer rounded-full border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary)"
                style={{ background: preset.value, borderColor: LINE }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Separator />

      <ToolbarButton label="Danh sách" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IconBulletList className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IconOrderedList className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Trích dẫn" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <IconQuote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <IconHorizontalRule className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      <ToolbarButton label="Căn trái" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <IconAlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Căn giữa"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <IconAlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Căn phải" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <IconAlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Căn đều"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <IconAlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator />

      {/* Popover liên kết / ảnh neo theo MÉP PHẢI của toolbar (toolbar là `relative`, wrapper của nút cố ý
          KHÔNG relative) và bề rộng bị chặn trong toolbar — luôn nằm trọn trong khung editor dù nút ở vị trí
          nào sau khi toolbar xuống dòng. Mobile: trải hết bề ngang toolbar. */}
      <div>
        <ToolbarButton
          label="Chèn liên kết"
          active={editor.isActive("link")}
          expanded={linkOpen}
          onClick={() => {
            setAltOpen(false);
            if (linkOpen) setLinkOpen(false);
            else openLinkDialog();
          }}
        >
          <IconLinkChain className="h-4 w-4" />
        </ToolbarButton>
        {linkOpen ? (
          <div
            onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
            className="absolute top-full right-2 left-2 z-20 mt-1 flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-lg sm:left-auto sm:w-80"
            style={{ borderColor: LINE }}
          >
            <label htmlFor={linkInputId} className="text-xs font-medium" style={{ color: INK }}>
              URL liên kết
            </label>
            <input
              id={linkInputId}
              autoFocus
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
              className="min-w-0 rounded-md border px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-primary)/20"
              style={{ borderColor: LINE }}
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="cursor-pointer rounded-md px-3 py-2 text-xs font-semibold hover:bg-gray-100"
                style={{ color: ACTIVE_FG }}
              >
                {linkUrl.trim() ? "Áp dụng" : "Gỡ liên kết"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {onInsertImage ? (
        <ToolbarButton
          label={imageBusy ? "Đang tải ảnh lên..." : "Chèn ảnh từ máy (PNG, JPG, WebP, tối đa 5MB)"}
          disabled={imageBusy}
          onClick={() => {
            setLinkOpen(false);
            setAltOpen(false);
            onInsertImage();
          }}
        >
          {imageBusy ? <IconSpinner className="h-4 w-4" /> : <IconImagePic className="h-4 w-4" />}
        </ToolbarButton>
      ) : null}

      {/* Chỉ hiện khi đang chọn một ảnh trong nội dung — sửa mô tả (alt) cho trình đọc màn hình/SEO. */}
      {imageSelected ? (
        <div>
          <ToolbarButton
            label="Sửa mô tả ảnh (alt)"
            expanded={altOpen}
            onClick={() => {
              setLinkOpen(false);
              if (altOpen) setAltOpen(false);
              else openAltDialog();
            }}
          >
            <span className="text-xs font-semibold">Alt</span>
          </ToolbarButton>
          {altOpen ? (
            <div
              onKeyDown={(e) => e.key === "Escape" && setAltOpen(false)}
              className="absolute top-full right-2 left-2 z-20 mt-1 flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-lg sm:left-auto sm:w-80"
              style={{ borderColor: LINE }}
            >
              <label htmlFor={altInputId} className="text-xs font-medium" style={{ color: INK }}>
                Mô tả ảnh (alt)
              </label>
              <input
                id={altInputId}
                autoFocus
                type="text"
                maxLength={200}
                placeholder="Vd: Bìa sách bài tập Toán lớp 5"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyAlt();
                  }
                }}
                className="min-w-0 rounded-md border px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-(--color-primary)/20"
                style={{ borderColor: LINE }}
              />
              <p className="text-xs text-gray-600">Mô tả ngắn nội dung ảnh cho người dùng trình đọc màn hình và công cụ tìm kiếm.</p>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setAltOpen(false)}
                  className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={applyAlt}
                  className="cursor-pointer rounded-md px-3 py-2 text-xs font-semibold hover:bg-gray-100"
                  style={{ color: ACTIVE_FG }}
                >
                  Lưu mô tả
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Separator />

      <ToolbarButton label="Hoàn tác" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <IconUndo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Làm lại" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <IconRedo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
