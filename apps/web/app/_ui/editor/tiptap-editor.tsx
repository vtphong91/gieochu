"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { countWordsInHtml } from "@gieochu/core/content/word-count";
import { buildTiptapExtensions } from "./extensions";
import { TiptapToolbar } from "./tiptap-toolbar";

/**
 * API mệnh lệnh expose ra ngoài qua onEditorReady — chưa ai gọi tới ở Giai
 * đoạn 1 (không có panel AI nào tồn tại), chuẩn bị sẵn cho Giai đoạn 2 (AI
 * Content Creator) cắm vào mà không cần sửa lại component này. Xem
 * docs/GIEOCHU_TIPTAP_EDITOR_AI_ROADMAP_V1.0.md §1.1.
 */
export interface TiptapEditorApi {
  insertAtCursor: (html: string) => void;
  appendToEnd: (html: string) => void;
  replaceAll: (html: string) => void;
  getSelectionText: () => string;
}

export interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onEditorReady?: (api: TiptapEditorApi) => void;
}

export function TiptapEditor({ content, onChange, placeholder, onEditorReady }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildTiptapExtensions(placeholder ?? "Bắt đầu viết nội dung..."),
    content,
    editorProps: {
      attributes: { class: "gieochu-editor-content focus:outline-none min-h-[280px] px-4 py-3" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Chiều vào (app -> editor): chỉ setContent khi khác nhau thật (tránh vòng
  // lặp với onUpdate), cố khôi phục vị trí con trỏ — đúng mô hình
  // "semi-controlled" đã kiểm chứng ở báo cáo tham khảo §2.6.
  useEffect(() => {
    if (!editor || content === editor.getHTML()) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(content, { emitUpdate: false });
    const docSize = editor.state.doc.content.size;
    try {
      editor.commands.setTextSelection({ from: Math.min(from, docSize), to: Math.min(to, docSize) });
    } catch {
      // Giữ nguyên con trỏ mặc định nếu nội dung mới đổi cấu trúc quá nhiều để khôi phục chính xác.
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady({
      insertAtCursor: (html) => editor.chain().focus().insertContent(html).run(),
      appendToEnd: (html) => editor.chain().focus("end").insertContent(html).run(),
      replaceAll: (html) => editor.commands.setContent(html),
      getSelectionText: () => {
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, " ");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần chạy lại khi editor instance đổi, không phải mỗi lần onEditorReady re-tạo
  }, [editor]);

  if (!editor) return null;

  const wordCount = countWordsInHtml(content);

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "#E5E7EB" }}>
      <TiptapToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end border-t px-3 py-1.5 text-xs text-gray-400" style={{ borderColor: "#E5E7EB" }}>
        {wordCount} từ
      </div>
    </div>
  );
}
