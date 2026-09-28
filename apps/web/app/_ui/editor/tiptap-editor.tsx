"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import { countWordsInHtml } from "@gieochu/core/content/word-count";
import { IconAlertTriangle, IconCheckCircle } from "../../admin/_ui/icons";
import { buildTiptapExtensions } from "./extensions";
import { EDITOR_IMAGE_ACCEPT, altFromFileName, uploadEditorImage, validateEditorImage, type TiptapImageUpload } from "./image-upload";
import { TiptapToolbar } from "./tiptap-toolbar";

export type { TiptapImageUpload } from "./image-upload";

type ImageUploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "done"; fileName: string }
  | { status: "error"; message: string; quota: boolean };

function firstImageFile(files: FileList | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ?? null;
}

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
  /**
   * ADR-028 — chèn ảnh bằng upload file (nút ảnh, kéo-thả, dán). Không truyền → ẩn nút ảnh, bỏ qua ảnh kéo/dán
   * (nơi dùng không có ngữ cảnh ký upload phù hợp).
   */
  imageUpload?: TiptapImageUpload;
}

export function TiptapEditor({ content, onChange, placeholder, onEditorReady, imageUpload }: TiptapEditorProps) {
  const [imageState, setImageState] = useState<ImageUploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // editorProps (kéo-thả/dán) chỉ tạo 1 lần cùng editor — gọi upload qua ref để luôn dùng bản mới nhất.
  const startUploadRef = useRef<((file: File, dropPos?: number) => void) | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildTiptapExtensions(placeholder ?? "Bắt đầu viết nội dung..."),
    content,
    editorProps: {
      attributes: { class: "gieochu-editor-content focus:outline-none min-h-[280px] px-4 py-3" },
      handlePaste: (_view, event) => {
        const file = startUploadRef.current ? firstImageFile(event.clipboardData?.files) : null;
        if (!file) return false;
        event.preventDefault();
        startUploadRef.current?.(file);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !startUploadRef.current) return false;
        const file = firstImageFile(event.dataTransfer?.files);
        if (!file) return false;
        event.preventDefault();
        startUploadRef.current(file, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
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

  const isUploading = imageState.status === "uploading";

  useEffect(() => {
    if (!editor || !imageUpload) {
      startUploadRef.current = null;
      return;
    }
    startUploadRef.current = (file, dropPos) => {
      if (isUploading) return;
      const invalid = validateEditorImage(file);
      if (invalid) {
        setImageState({ status: "error", message: invalid, quota: false });
        return;
      }
      // Kéo-thả: đặt con trỏ tại điểm thả ngay — ảnh sẽ chèn vào đó khi tải xong.
      if (dropPos !== undefined) editor.commands.setTextSelection(dropPos);
      setImageState({ status: "uploading", fileName: file.name, progress: 0 });
      void uploadEditorImage(file, imageUpload, (progress) =>
        setImageState((prev) => (prev.status === "uploading" ? { ...prev, progress } : prev)),
      ).then((result) => {
        if (editor.isDestroyed) return;
        if (!result.ok) {
          setImageState({ status: "error", message: result.error, quota: result.errorCode === "IMAGE_QUOTA_EXCEEDED" });
          return;
        }
        editor.chain().focus().setImage({ src: result.url, alt: altFromFileName(file.name) }).run();
        setImageState({ status: "done", fileName: file.name });
      });
    };
  }, [editor, imageUpload, isUploading]);

  // Thông báo "đã chèn" tự ẩn sau vài giây; lỗi giữ tới khi người dùng đóng hoặc thử lại.
  useEffect(() => {
    if (imageState.status !== "done") return;
    const timer = window.setTimeout(() => setImageState({ status: "idle" }), 6000);
    return () => window.clearTimeout(timer);
  }, [imageState]);

  if (!editor) return null;

  const wordCount = countWordsInHtml(content);

  return (
    // KHÔNG dùng overflow-hidden ở khung ngoài: popover của toolbar (URL ảnh/liên kết) tràn ra ngoài khung
    // sẽ bị cắt, và khi input autoFocus trong popover, trình duyệt cuộn ngang chính khung overflow-hidden đó
    // để đưa input vào tầm nhìn — toàn bộ toolbar + nội dung bị đẩy sang trái ("oạn văn", placeholder mất chữ
    // đầu). Bo góc do toolbar (rounded-t-lg) và footer (rounded-b-lg) tự đảm nhận.
    <div
      className="rounded-lg border bg-white transition-shadow focus-within:ring-2 focus-within:ring-(--color-primary)/20"
      style={{ borderColor: "#E5E7EB" }}
    >
      <TiptapToolbar
        editor={editor}
        onInsertImage={imageUpload ? () => fileInputRef.current?.click() : undefined}
        imageBusy={isUploading}
      />
      {imageUpload ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={EDITOR_IMAGE_ACCEPT}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) startUploadRef.current?.(file);
            }}
          />
          {/* Vùng trạng thái luôn có mặt để trình đọc màn hình đọc được tiến độ/kết quả (role=status, polite). */}
          <div role="status">
            {imageState.status === "uploading" ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs text-gray-700" style={{ borderColor: "#E5E7EB" }}>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  Đang tải ảnh “{imageState.fileName}” lên… {imageState.progress}%
                </span>
                <progress value={imageState.progress} max={100} aria-label="Tiến độ tải ảnh" className="h-1.5 w-28 shrink-0 accent-(--color-primary)" />
              </div>
            ) : imageState.status === "done" ? (
              <p className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "#E5E7EB", color: "#166534" }}>
                <IconCheckCircle className="h-4 w-4 shrink-0" />
                <span>Đã chèn ảnh. Nhấn vào ảnh rồi chọn nút “Alt” để sửa mô tả ảnh.</span>
              </p>
            ) : null}
          </div>
          {imageState.status === "error" ? (
            <div role="alert" className="flex items-start gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}>
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="min-w-0 flex-1">
                {imageState.message}
                {imageState.quota && imageUpload.upgradeHref ? (
                  <>
                    {" "}
                    <Link href={imageUpload.upgradeHref} className="font-semibold underline underline-offset-2">
                      Xem gói để nâng hạn mức ảnh
                    </Link>
                  </>
                ) : null}
              </p>
              <button
                type="button"
                onClick={() => setImageState({ status: "idle" })}
                className="-my-1 shrink-0 cursor-pointer rounded-md px-2 py-1 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#991B1B]"
              >
                Đóng
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      <EditorContent editor={editor} className="min-w-0" />
      <div className="flex items-center justify-end rounded-b-lg border-t px-3 py-1.5 text-xs text-gray-500" style={{ borderColor: "#E5E7EB" }}>
        {wordCount} từ
      </div>
    </div>
  );
}
