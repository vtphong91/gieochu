"use client";

import { useEffect, useId, useRef, useState, useTransition, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import {
  addProductLinkAction,
  getProductFilePreviewAction,
  removeProductFileAction,
  removeProductLinkAction,
  updateProductLinkAction,
  type ProductActionState,
  type ProductLinkState,
} from "../actions";
import { Badge, ConfigCard, EmptyState, TextField } from "../../../../admin/_ui/kit";
import { IconExternalLink, IconEye, IconFile, IconTrash, IconUpload } from "../../../../admin/_ui/icons";
import { IconLinkChain } from "../../../../_ui/editor/toolbar-icons";
import { formatBytes, uploadProductFile, type UploadedProductFile } from "./upload-client";
import { ViewDocsModal } from "../../../../_ui/view-docs";
import { GHOST_BTN, GREEN_TEXT, PRIMARY_BTN, ProgressBar, ROW_BTN, UploadError, WarningNote } from "./editor-bits";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

/**
 * Id form KHÔNG tồn tại: gán qua thuộc tính `form` cho các ô nằm trong <form> sản phẩm nhưng không thuộc
 * về nó (thêm link, chọn cách thêm, đánh dấu preview) — không bị gửi kèm, không bị validate/reset theo form
 * cha, và Enter trong các ô này không submit form sản phẩm (quy tắc editor: Enter trong ô link không submit).
 */
export const DETACHED_FORM_ID = "product-editor-detached-fields";

export interface EditorFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED" | null;
  isPreview: boolean;
  createdAtLabel: string;
}

export interface EditorLink {
  id: string;
  label: string;
  url: string;
  host: string;
  isAllowed: boolean;
}

const SCAN_BADGE: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  PENDING: { tone: "warning", label: "Đang quét" },
  CLEAN: { tone: "success", label: "An toàn" },
  REJECTED: { tone: "danger", label: "Bị từ chối" },
};

interface QueueItem {
  key: string;
  file: File;
  isPreview: boolean;
  progress: number;
  status: "waiting" | "uploading" | "error";
  error?: string;
}

/**
 * Kết quả "đảm bảo đã có sản phẩm để gắn tài liệu". Trang Sửa: trả ngay id hiện có. Trang Tạo (sửa đổi ADR-027 §4):
 * lần thêm file/link đầu tiên tự tạo bản nháp Riêng tư — mọi lời gọi đồng thời dùng chung một lần tạo.
 */
export type EnsureProductResult = { ok: true; productId: string } | { ok: false; error: string };

const RED = "#DC2626";
const GRAY_LINE = "#E5E7EB";

const vnDate = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toEditorLink(link: ProductLinkState): EditorLink {
  return { id: link.id, label: link.label, url: link.url, host: hostOf(link.url), isAllowed: link.isAllowed };
}

function toEditorFile(file: UploadedProductFile): EditorFile {
  const created = file.createdAt ? new Date(file.createdAt) : new Date();
  return {
    id: file.id,
    fileName: file.fileName,
    sizeBytes: file.sizeBytes,
    scanStatus: file.scanStatus,
    isPreview: file.isPreview,
    createdAtLabel: vnDate.format(Number.isNaN(created.getTime()) ? new Date() : created),
  };
}

/**
 * Card "Tệp tài liệu" — dùng cho cả trang Tạo lẫn Sửa (sửa đổi ADR-027 §4: trang Tạo không còn khoá card này).
 * - `sync="server"` (trang Sửa): danh sách file/link lấy từ loader; thêm xong thì `router.refresh()` / revalidate.
 * - `sync="local"` (trang Tạo, kể cả sau khi đã tự tạo bản nháp): KHÔNG refresh route (route vẫn là trang Tạo nên
 *   refresh không mang dữ liệu file về) — file/link vừa thêm được giữ cục bộ từ dữ liệu `complete` trả về / dữ liệu
 *   vừa nhập.
 * `status`: dòng trạng thái tạo bản nháp — vùng aria-live của card.
 */
export function DeliverySourcesCard({
  tenantSlug,
  productId,
  files,
  links,
  allowedHosts,
  sync = "server",
  ensureProductId,
  onUploadingChange,
  status,
}: {
  tenantSlug: string;
  productId: string | null;
  files: EditorFile[];
  links: EditorLink[];
  allowedHosts: string[];
  sync?: "server" | "local";
  ensureProductId?: () => Promise<EnsureProductResult>;
  /** Báo editor còn file đang chờ/đang tải (không chuyển trang, cảnh báo khi rời trang). */
  onUploadingChange?: (uploading: boolean) => void;
  status?: ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "link">("file");
  const groupName = useId();
  const [localFiles, setLocalFiles] = useState<EditorFile[]>([]);
  const [localLinks, setLocalLinks] = useState<EditorLink[]>([]);
  const local = sync === "local";
  const shownFiles = local ? localFiles : files;
  const shownLinks = local ? localLinks : links;

  const cleanSaleFiles = shownFiles.filter((f) => f.scanStatus === "CLEAN" && !f.isPreview).length;
  const validLinks = shownLinks.filter((l) => l.isAllowed).length;
  const hasSource = cleanSaleFiles + validLinks > 0;
  // File bán vừa tải còn đang quét → chưa tính là nguồn giao hàng; báo rõ để không hiểu nhầm là "chưa có gì".
  const scanning = shownFiles.some((f) => f.scanStatus === "PENDING" && !f.isPreview);

  function ensure(): Promise<EnsureProductResult> {
    if (ensureProductId) return ensureProductId();
    return Promise.resolve(productId ? { ok: true, productId } : { ok: false, error: "Chưa có sản phẩm để thêm tài liệu." });
  }

  return (
    <ConfigCard
      icon={<IconFile className="h-5 w-5" />}
      title="Tệp tài liệu"
      description="Khách nhận các file bán và link tài liệu này sau khi thanh toán. Có thể dùng cả hai cùng lúc."
      badges={
        hasSource ? (
          <Badge tone="success">Đã có nguồn giao hàng</Badge>
        ) : scanning ? (
          <Badge tone="warning">File đang quét virus</Badge>
        ) : (
          <Badge tone="warning">Chưa có nguồn giao hàng</Badge>
        )
      }
    >
      <div className="space-y-5">
        <p role="status" aria-live="polite" className="text-sm empty:hidden" style={{ color: brandColors.ink }}>
          {status}
        </p>

        <fieldset>
          <legend className="text-sm font-medium" style={{ color: brandColors.ink }}>
            Thêm tài liệu bằng cách
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl p-1 sm:inline-grid" style={{ background: "#F3F4F6" }}>
            {(
              [
                { value: "file", label: "Tải file lên", icon: <IconUpload className="h-4 w-4" /> },
                { value: "link", label: "Link tài liệu", icon: <IconLinkChain className="h-4 w-4" /> },
              ] as const
            ).map((option) => {
              const checked = mode === option.value;
              return (
                <label
                  key={option.value}
                  className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#0F3B82] sm:min-h-10"
                  style={checked ? { background: "#FFFFFF", color: brandColors.primary, boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)" } : { color: "#4B5563" }}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={option.value}
                    checked={checked}
                    onChange={() => setMode(option.value)}
                    form={DETACHED_FORM_ID}
                    className="sr-only"
                  />
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Ẩn (không gỡ) khối không chọn: đổi sang "Link tài liệu" giữa chừng không làm mất hàng đợi đang tải. */}
        <div hidden={mode !== "file"}>
          <FileUploader
            tenantSlug={tenantSlug}
            ensureProductId={ensure}
            onUploadingChange={onUploadingChange}
            onUploaded={(file) => {
              if (!local) {
                router.refresh();
                return;
              }
              if (file) setLocalFiles((current) => [...current.filter((f) => f.id !== file.id), toEditorFile(file)]);
            }}
          />
        </div>
        <div hidden={mode !== "link"}>
          <AddLinkForm
            tenantSlug={tenantSlug}
            productId={productId}
            ensureProductId={ensure}
            allowedHosts={allowedHosts}
            onAdded={(link) => {
              if (local) setLocalLinks((current) => [...current.filter((l) => l.id !== link.id), toEditorLink(link)]);
            }}
          />
        </div>

        {shownFiles.length === 0 && shownLinks.length === 0 ? (
          <EmptyState
            icon={<IconFile className="h-6 w-6" />}
            title="Chưa có tài liệu nào"
            description="Tải file lên hoặc thêm link tài liệu. Cần ít nhất 1 file bán đã quét an toàn hoặc 1 link hợp lệ để xuất bản."
          />
        ) : null}

        {productId && shownFiles.length > 0 ? (
          <FileList
            tenantSlug={tenantSlug}
            productId={productId}
            files={shownFiles}
            onRemoved={(id) => {
              if (local) setLocalFiles((current) => current.filter((f) => f.id !== id));
            }}
          />
        ) : null}
        {productId && shownLinks.length > 0 ? (
          <LinkList
            tenantSlug={tenantSlug}
            productId={productId}
            links={shownLinks}
            onUpdated={(link) => {
              if (local) setLocalLinks((current) => current.map((l) => (l.id === link.id ? toEditorLink(link) : l)));
            }}
            onRemoved={(id) => {
              if (local) setLocalLinks((current) => current.filter((l) => l.id !== id));
            }}
          />
        ) : null}
      </div>
    </ConfigCard>
  );
}

/* ------------------------------- Upload file ------------------------------- */

function FileUploader({
  tenantSlug,
  ensureProductId,
  onUploaded,
  onUploadingChange,
}: {
  tenantSlug: string;
  ensureProductId: () => Promise<EnsureProductResult>;
  /** File đã tải + xác nhận xong (null nếu server không trả bản ghi đúng dạng). */
  onUploaded: (file: UploadedProductFile | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ file: File; fileName: string; sizeBytes?: number } | null>(null);
  const runningRef = useRef(false);
  const previewId = useId();
  const hintId = useId();

  function patch(key: string, next: Partial<QueueItem>) {
    setQueue((current) => current.map((item) => (item.key === key ? { ...item, ...next } : item)));
  }

  // Còn file chờ/đang tải (không tính file lỗi) → báo editor.
  const active = queue.some((item) => item.status !== "error");
  useEffect(() => {
    onUploadingChange?.(active);
  }, [active, onUploadingChange]);

  async function runOne(item: QueueItem, productId: string): Promise<void> {
    patch(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const uploaded = await uploadProductFile(tenantSlug, productId, item.file, item.isPreview, (ratio) => patch(item.key, { progress: ratio }));
      setQueue((current) => current.filter((q) => q.key !== item.key));
      setAnnouncement(`Đã tải lên ${item.file.name}. File đang được quét virus.`);
      onUploaded(uploaded);
    } catch (err) {
      patch(item.key, { status: "error", error: err instanceof Error ? err.message : "Tải file lên thất bại." });
    }
  }

  /**
   * Hàng đợi tải LẦN LƯỢT từng file (tránh vượt hạn mức gói giữa chừng khi chạy song song). File thêm
   * trong lúc đang tải, hoặc bấm "Thử lại", được xếp vào cuối hàng đợi.
   * Trước mỗi file: `ensureProductId()` — trang Tạo tự tạo bản nháp ở lần đầu (các file cùng đợt chờ chung một lần
   * tạo). Không tạo được (thiếu tiêu đề / lỗi form) → mọi file đang chờ chuyển sang lỗi, GIỮ trong danh sách để bấm
   * "Thử lại" mà không phải chọn lại file.
   */
  const pendingRef = useRef<QueueItem[]>([]);
  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (pendingRef.current.length > 0) {
        const ensured = await ensureProductId();
        if (!ensured.ok) {
          const failed = new Set(pendingRef.current.splice(0).map((item) => item.key));
          setQueue((current) => current.map((item) => (failed.has(item.key) ? { ...item, status: "error", progress: 0, error: ensured.error } : item)));
          break;
        }
        const next = pendingRef.current.shift();
        if (next) await runOne(next, ensured.productId);
      }
    } finally {
      runningRef.current = false;
    }
  }

  function enqueue(items: QueueItem[]) {
    pendingRef.current.push(...items);
    void pump();
  }

  function retry(item: QueueItem) {
    patch(item.key, { status: "waiting", progress: 0, error: undefined });
    enqueue([item]);
  }

  const seqRef = useRef(0);
  function addFiles(list: FileList | File[]) {
    seqRef.current += 1;
    const stamp = seqRef.current;
    const items: QueueItem[] = Array.from(list).map((file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      file,
      isPreview,
      progress: 0,
      status: "waiting",
    }));
    if (items.length === 0) return;
    setQueue((current) => [...current, ...items]);
    enqueue(items);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
        style={{ borderColor: dragging ? brandColors.primary : "#D1D5DB", background: dragging ? brandColors.surface : "#FAFAFA" }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: brandColors.surface, color: brandColors.primary }}>
          <IconUpload className="h-5 w-5" />
        </span>
        <p className="text-sm" style={{ color: brandColors.ink }}>
          <span className="hidden sm:inline">Kéo và thả file vào đây, hoặc bấm nút bên dưới.</span>
          <span className="sm:hidden">Chọn file tài liệu từ thiết bị của bạn.</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          form={DETACHED_FORM_ID}
          onChange={(event) => {
            const selected = event.target.files;
            if (selected && selected.length > 0) addFiles(Array.from(selected));
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={GHOST_BTN}
          style={{ borderColor: GRAY_LINE, color: brandColors.ink, background: "#FFFFFF" }}
          aria-describedby={hintId}
        >
          <IconUpload className="h-4 w-4" /> Chọn file
        </button>
        <p id={hintId} className="text-xs" style={{ color: "#6B7280" }}>
          Chọn được nhiều file cùng lúc. Mỗi file được quét virus trước khi giao cho khách.
        </p>
      </div>

      <label htmlFor={previewId} className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm sm:min-h-0" style={{ color: brandColors.ink }}>
        <input
          id={previewId}
          type="checkbox"
          checked={isPreview}
          onChange={(e) => setIsPreview(e.target.checked)}
          form={DETACHED_FORM_ID}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#0F3B82]"
        />
        <span>
          Tải lên dưới dạng <strong>file xem trước</strong>
          <span className="block text-xs" style={{ color: "#6B7280" }}>
            Công khai cho mọi người xem thử, không cần mua — không tính là file giao cho khách.
          </span>
        </span>
      </label>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {queue.length > 0 ? (
        <ul className="space-y-2" aria-label="File đang tải lên">
          {queue.map((item) => (
            <li key={item.key} className="rounded-lg border p-3" style={{ borderColor: GRAY_LINE }}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                  {item.file.name}
                </span>
                <span className="text-xs tabular-nums" style={{ color: "#6B7280" }}>
                  {formatBytes(item.file.size)}
                </span>
                {item.isPreview ? <Badge tone="info">Xem trước</Badge> : null}
                <button
                  type="button"
                  onClick={() => setPreviewDoc({ file: item.file, fileName: item.file.name, sizeBytes: item.file.size })}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  title="Xem trước nội dung file"
                >
                  <IconEye className="h-3.5 w-3.5 text-gray-500" />
                  <span>Xem trước</span>
                </button>
              </div>
              <div className="mt-2">
                {item.status === "error" ? (
                  <UploadError
                    message={item.error ?? "Tải file lên thất bại."}
                    onRetry={() => retry(item)}
                    onDismiss={() => setQueue((current) => current.filter((q) => q.key !== item.key))}
                  />
                ) : item.status === "waiting" ? (
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    Đang chờ tải lên...
                  </p>
                ) : (
                  <ProgressBar label={`Tiến độ tải ${item.file.name}`} value={item.progress} />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <ViewDocsModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        file={previewDoc?.file}
        fileName={previewDoc?.fileName ?? ""}
        sizeBytes={previewDoc?.sizeBytes}
      />
    </div>
  );
}

function FileList({
  tenantSlug,
  productId,
  files,
  onRemoved,
}: {
  tenantSlug: string;
  productId: string;
  files: EditorFile[];
  onRemoved?: (fileId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; sizeBytes?: number; mimeType?: string | null } | null>(null);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handlePreviewFile(file: EditorFile) {
    setError(null);
    setLoadingPreviewId(file.id);
    try {
      const res = await getProductFilePreviewAction(tenantSlug, productId, file.id);
      if (!res.ok || !res.url) {
        setError(res.error || "Không thể lấy liên kết xem trước tài liệu.");
      } else {
        setPreviewDoc({
          url: res.url,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
          mimeType: res.mimeType,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi mở tài liệu xem trước.");
    } finally {
      setLoadingPreviewId(null);
    }
  }

  function remove(file: EditorFile) {
    if (!window.confirm(`Gỡ file "${file.fileName}" khỏi sản phẩm? Khách mua sau sẽ không nhận file này.`)) return;
    setError(null);
    setPendingId(file.id);
    startTransition(async () => {
      const result = await removeProductFileAction(tenantSlug, productId, file.id);
      if (result.error) setError(result.error);
      else onRemoved?.(file.id);
      setPendingId(null);
    });
  }

  return (
    <section aria-labelledby="product-files-heading">
      <h3 id="product-files-heading" className="text-sm font-semibold" style={{ color: brandColors.ink }}>
        File đã tải lên ({files.length})
      </h3>
      {error ? (
        <p role="alert" className="mt-2 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : null}
      <ul className="mt-2 divide-y rounded-xl border" style={{ borderColor: GRAY_LINE }}>
        {files.map((file) => {
          const scan = file.scanStatus ? SCAN_BADGE[file.scanStatus] : undefined;
          return (
            <li key={file.id} className="flex flex-wrap items-center gap-3 p-3" style={{ borderColor: GRAY_LINE }}>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ background: brandColors.surface, color: brandColors.primary }}>
                <IconFile className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                  {file.fileName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
                  <span className="tabular-nums">{formatBytes(file.sizeBytes)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{file.createdAtLabel}</span>
                  <Badge tone={scan?.tone ?? "neutral"}>{scan?.label ?? "Chưa quét"}</Badge>
                  {file.isPreview ? <Badge tone="info">Xem trước</Badge> : <Badge tone="neutral">File bán</Badge>}
                </div>
                {file.scanStatus === "REJECTED" ? (
                  <p className="mt-1 text-xs" style={{ color: RED }}>
                    File không vượt qua kiểm tra an toàn và sẽ không được giao cho khách. Hãy gỡ và tải lại file khác.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreviewFile(file)}
                  disabled={loadingPreviewId === file.id}
                  aria-label={`Xem trước file ${file.fileName}`}
                  className={ROW_BTN}
                  style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}
                >
                  {loadingPreviewId === file.id ? (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  ) : (
                    <IconEye className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{loadingPreviewId === file.id ? "Đang mở..." : "Xem trước"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(file)}
                  disabled={pendingId === file.id}
                  aria-label={`Gỡ file ${file.fileName}`}
                  className={ROW_BTN}
                  style={{ background: "#FEF2F2", color: RED }}
                >
                  <IconTrash className="h-4 w-4" />
                  <span className="hidden sm:inline">{pendingId === file.id ? "Đang gỡ..." : "Gỡ"}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ViewDocsModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url}
        fileName={previewDoc?.fileName ?? ""}
        sizeBytes={previewDoc?.sizeBytes}
        mimeType={previewDoc?.mimeType}
      />
    </section>
  );
}

/* ------------------------------- Link tài liệu ------------------------------ */

function AddLinkForm({
  tenantSlug,
  productId,
  ensureProductId,
  allowedHosts,
  onAdded,
}: {
  tenantSlug: string;
  productId: string | null;
  ensureProductId: () => Promise<EnsureProductResult>;
  allowedHosts: string[];
  /** Link vừa thêm (bản ghi server trả về). */
  onAdded: (link: ProductLinkState) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const baseId = useId();

  function submit() {
    if (isPending) return;
    const value = { label: label.trim(), url: url.trim() };
    // Chưa có sản phẩm: chặn ô trống ngay ở client để không tạo bản nháp chỉ để nhận lỗi "thiếu tên/đường dẫn".
    if (!productId && (!value.label || !value.url)) {
      setState({
        error: "Vui lòng kiểm tra lại các trường bị lỗi.",
        fieldErrors: {
          ...(value.label ? {} : { label: "Nhập tên hiển thị cho khách." }),
          ...(value.url ? {} : { url: "Nhập đường dẫn https:// của tài liệu." }),
        },
      });
      return;
    }
    const fd = new FormData();
    fd.set("label", label);
    fd.set("url", url);
    setState({});
    startTransition(async () => {
      // Trang Tạo: lần thêm đầu tự tạo bản nháp (dùng chung với file đang tải nếu có).
      const ensured = await ensureProductId();
      if (!ensured.ok) {
        setState({ error: ensured.error });
        return;
      }
      const result = await addProductLinkAction(tenantSlug, ensured.productId, {}, fd);
      setState(result);
      if (result.ok) {
        if (result.link) onAdded(result.link);
        setLabel("");
        setUrl("");
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="space-y-4">
      <WarningNote title="Lưu ý khi dùng link ngoài">
        Link ngoài không được quét, không chống chia sẻ lại; bạn chịu trách nhiệm quyền truy cập của link. Khách chỉ thấy link sau khi mua,
        trong Thư viện.
      </WarningNote>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${baseId}-label`}
          label="Tên hiển thị cho khách"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={onKeyDown}
          form={DETACHED_FORM_ID}
          placeholder="vd: Bộ đề PDF (Google Drive)"
          error={state.fieldErrors?.label}
          maxLength={200}
        />
        <TextField
          id={`${baseId}-url`}
          label="Đường dẫn (https://)"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={onKeyDown}
          form={DETACHED_FORM_ID}
          placeholder="https://drive.google.com/..."
          error={state.fieldErrors?.url}
          hint="Chỉ nhận link https từ dịch vụ được chấp nhận bên dưới."
        />
      </div>
      <div className="text-xs" style={{ color: "#6B7280" }}>
        <p id={`${baseId}-hosts`}>Dịch vụ được chấp nhận:</p>
        <ul aria-labelledby={`${baseId}-hosts`} className="mt-1.5 flex flex-wrap gap-1.5">
          {allowedHosts.map((host) => (
            <li key={host} className="rounded-md border px-2 py-0.5 font-mono" style={{ borderColor: GRAY_LINE, color: brandColors.ink }}>
              {host}
            </li>
          ))}
        </ul>
      </div>
      {state.error && !state.fieldErrors ? (
        <p role="alert" className="text-sm" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm" style={{ color: GREEN_TEXT }}>
          Đã thêm link tài liệu.
        </p>
      ) : null}
      <button type="button" onClick={submit} disabled={isPending} className={PRIMARY_BTN} style={{ background: brandColors.primary }}>
        <IconLinkChain className="h-4 w-4" /> {isPending ? "Đang thêm..." : "Thêm link"}
      </button>
    </div>
  );
}

type LinkCallbacks = {
  /** Trang Tạo (danh sách cục bộ): cập nhật dòng sau khi sửa/gỡ. Trang Sửa: revalidate tự làm mới. */
  onUpdated?: (link: ProductLinkState) => void;
  onRemoved?: (linkId: string) => void;
};

function LinkList({
  tenantSlug,
  productId,
  links,
  onUpdated,
  onRemoved,
}: { tenantSlug: string; productId: string; links: EditorLink[] } & LinkCallbacks) {
  return (
    <section aria-labelledby="product-links-heading">
      <h3 id="product-links-heading" className="text-sm font-semibold" style={{ color: brandColors.ink }}>
        Link tài liệu ({links.length})
      </h3>
      <ul className="mt-2 divide-y rounded-xl border" style={{ borderColor: GRAY_LINE }}>
        {links.map((link) => (
          <LinkRow key={link.id} tenantSlug={tenantSlug} productId={productId} link={link} onUpdated={onUpdated} onRemoved={onRemoved} />
        ))}
      </ul>
    </section>
  );
}

function LinkRow({
  tenantSlug,
  productId,
  link,
  onUpdated,
  onRemoved,
}: { tenantSlug: string; productId: string; link: EditorLink } & LinkCallbacks) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);
  const [state, setState] = useState<ProductActionState>({});
  const [isPending, startTransition] = useTransition();
  const baseId = useId();

  function save() {
    if (isPending) return;
    const fd = new FormData();
    fd.set("label", label);
    fd.set("url", url);
    startTransition(async () => {
      const result = await updateProductLinkAction(tenantSlug, productId, link.id, {}, fd);
      setState(result);
      if (result.ok) {
        setEditing(false);
        if (result.link) onUpdated?.(result.link);
      }
    });
  }

  function remove() {
    if (!window.confirm(`Gỡ link "${link.label}"? Khách đã mua sẽ không còn thấy link này trong Thư viện.`)) return;
    startTransition(async () => {
      const result = await removeProductLinkAction(tenantSlug, productId, link.id);
      if (result.error) setState(result);
      else onRemoved?.(link.id);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
      setLabel(link.label);
      setUrl(link.url);
      setState({});
    }
  }

  return (
    <li className="p-3" style={{ borderColor: GRAY_LINE }}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`${baseId}-label`}
              label="Tên hiển thị"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={onKeyDown}
              form={DETACHED_FORM_ID}
              error={state.fieldErrors?.label}
              maxLength={200}
              autoFocus
            />
            <TextField
              id={`${baseId}-url`}
              label="Đường dẫn"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={onKeyDown}
              form={DETACHED_FORM_ID}
              error={state.fieldErrors?.url}
            />
          </div>
          {state.error && !state.fieldErrors ? (
            <p role="alert" className="text-sm" style={{ color: RED }}>
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={isPending} className={PRIMARY_BTN} style={{ background: brandColors.primary }}>
              {isPending ? "Đang lưu..." : "Lưu link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setLabel(link.label);
                setUrl(link.url);
                setState({});
              }}
              className={GHOST_BTN}
              style={{ borderColor: GRAY_LINE, color: brandColors.ink }}
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ background: brandColors.surface, color: brandColors.primary }}>
            <IconLinkChain className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
              {link.label}
            </p>
            <p className="mt-0.5 text-xs [overflow-wrap:anywhere]" style={{ color: "#6B7280" }}>
              {link.host}
            </p>
            {!link.isAllowed ? (
              <div className="mt-2">
                <WarningNote title="Link không còn hợp lệ">
                  Dịch vụ này không còn nằm trong danh sách được chấp nhận nên link không được tính là nguồn giao hàng. Hãy sửa sang link hợp lệ
                  hoặc gỡ link.
                </WarningNote>
              </div>
            ) : null}
            {state.error ? (
              <p role="alert" className="mt-1 text-sm" style={{ color: RED }}>
                {state.error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Mở link ${link.label} (tab mới)`}
              className={ROW_BTN}
              style={{ background: brandColors.surface, color: brandColors.primary }}
            >
              <IconExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Mở</span>
            </a>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Sửa link ${link.label}`}
              className={ROW_BTN}
              style={{ background: "#F3F4F6", color: "#374151" }}
            >
              Sửa
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              aria-label={`Gỡ link ${link.label}`}
              className={ROW_BTN}
              style={{ background: "#FEF2F2", color: RED }}
            >
              <IconTrash className="h-4 w-4" />
              <span className="hidden sm:inline">{isPending ? "Đang gỡ..." : "Gỡ"}</span>
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
