"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
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
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
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
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40"
      style={active ? { background: ACTIVE_BG, color: ACTIVE_FG } : { color: INK }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px shrink-0" style={{ background: LINE }} />;
}

export function TiptapToolbar({ editor }: { editor: Editor | null }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [colorOpen, setColorOpen] = useState(false);

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

  function applyImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    editor!.chain().focus().setImage({ src: url }).run();
    setImageOpen(false);
    setImageUrl("");
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
        className="h-8 rounded-md border px-2 text-sm outline-none"
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

      <div className="relative">
        <ToolbarButton label="Màu chữ" onClick={() => setColorOpen((v) => !v)}>
          <IconTextColor className="h-4 w-4" />
        </ToolbarButton>
        {colorOpen ? (
          <div className="absolute top-full left-0 z-20 mt-1 flex gap-1.5 rounded-lg border bg-white p-2 shadow-lg" style={{ borderColor: LINE }}>
            {TEXT_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.label}
                onClick={() => {
                  editor.chain().focus().setColor(preset.value).run();
                  setColorOpen(false);
                }}
                className="h-6 w-6 rounded-full border"
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

      <div className="relative">
        <ToolbarButton label="Chèn liên kết" active={editor.isActive("link")} onClick={openLinkDialog}>
          <IconLinkChain className="h-4 w-4" />
        </ToolbarButton>
        {linkOpen ? (
          <div className="absolute top-full left-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-lg border bg-white p-3 shadow-lg" style={{ borderColor: LINE }}>
            <input
              autoFocus
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
              className="rounded-md border px-2.5 py-1.5 text-sm outline-none"
              style={{ borderColor: LINE }}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLinkOpen(false)} className="text-xs font-medium text-gray-500">
                Huỷ
              </button>
              <button type="button" onClick={applyLink} className="text-xs font-semibold" style={{ color: ACTIVE_FG }}>
                {linkUrl.trim() ? "Áp dụng" : "Gỡ liên kết"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <ToolbarButton label="Chèn ảnh" onClick={() => setImageOpen((v) => !v)}>
          <IconImagePic className="h-4 w-4" />
        </ToolbarButton>
        {imageOpen ? (
          <div className="absolute top-full left-0 z-20 mt-1 flex w-72 flex-col gap-2 rounded-lg border bg-white p-3 shadow-lg" style={{ borderColor: LINE }}>
            <label className="text-xs font-medium" style={{ color: INK }}>
              URL ảnh
            </label>
            <div className="flex gap-2">
              <input
                autoFocus
                type="url"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyImageUrl()}
                className="min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-sm outline-none"
                style={{ borderColor: LINE }}
              />
              <button type="button" onClick={applyImageUrl} className="shrink-0 text-xs font-semibold" style={{ color: ACTIVE_FG }}>
                Chèn
              </button>
            </div>
          </div>
        ) : null}
      </div>

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
