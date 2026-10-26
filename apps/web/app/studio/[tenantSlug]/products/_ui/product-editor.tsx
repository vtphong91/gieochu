"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { PRODUCT_SUMMARY_MAX_LENGTH } from "@gieochu/core/product-summary";
import { productPath } from "@gieochu/core/product-path";
import { TiptapEditor, type TiptapImageUpload } from "../../../../_ui/editor/tiptap-editor";
import { getContentImageUploadSignatureAction, registerTenantImageAction } from "../../media-actions";
import {
  archiveProductAction,
  createProductAction,
  deleteProductAction,
  restoreProductAction,
  updateProductAction,
  type ProductActionState,
} from "../actions";
import { SelectField, TextField } from "../../../../admin/_ui/kit";
import { CollapsibleSection, revealSection, sectionStatus, type SectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";
import { IconAlertTriangle, IconCard, IconCheckCircle, IconDoc, IconExternalLink, IconEye, IconPackage, IconTag } from "../../../../admin/_ui/icons";
import { DeliverySourcesCard, type EditorFile, type EditorLink, type EnsureProductResult } from "./delivery-sources";
import { CoverImageCard } from "./cover-image-card";
import { TagInput } from "./tag-input";
import { PublishCard, type ModerationLock, type Visibility } from "./publish-card";
import { GHOST_BTN, GREEN_TEXT, PRIMARY_BTN, PRODUCT_TYPE_LABEL, WarningNote } from "./editor-bits";

const RED = "#DC2626";
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";
const AMBER = "#B45309";
const GREEN_SOFT = "#F0FDF4";
const GREEN_LINE = "#BBF7D0";
const GRAY_LINE = "#E5E7EB";
const INK_SOFT = "#6B7280";

/** Tên field FormData → nhãn hiển thị trong tóm tắt lỗi (id phần tử nhận focus = tên field). */
const FIELD_LABEL: Record<string, string> = {
  title: "Tiêu đề",
  slug: "Đường dẫn",
  summary: "Mô tả ngắn",
  description: "Mô tả chi tiết",
  coverImageUrl: "Ảnh đại diện",
  visibility: "Chế độ hiển thị",
  categoryId: "Danh mục",
  type: "Loại tài liệu",
  tags: "Thẻ",
  priceVnd: "Giá gốc",
  salePriceVnd: "Giá khuyến mãi",
  saleStartsAt: "Bắt đầu khuyến mãi",
  saleEndsAt: "Kết thúc khuyến mãi",
  downloadLimit: "Giới hạn lượt tải",
  rightsConfirmed: "Cam kết bản quyền",
};

/**
 * Field của form sản phẩm — chỉ các ô này mới bật trạng thái "Có thay đổi chưa lưu". Ô cam kết bản quyền (ADR-038)
 * không phải dữ liệu sản phẩm nên không tính.
 */
const PRODUCT_FIELDS = new Set(Object.keys(FIELD_LABEL).filter((key) => key !== "rightsConfirmed"));

/**
 * ADR-058 (task 2.3a): khối thu gọn → field. Dùng để đếm lỗi/"có thay đổi" theo khối và mở đúng khối khi bấm link trong
 * tóm tắt lỗi. Ảnh đại diện, Tệp tài liệu (component riêng) và card Xuất bản KHÔNG thu gọn.
 */
const SECTION_FIELDS = {
  "tai-lieu-thong-tin": ["title", "slug", "summary", "description"],
  "tai-lieu-gia": ["priceVnd", "salePriceVnd", "saleStartsAt", "saleEndsAt"],
  "tai-lieu-danh-muc": ["categoryId", "type"],
  "tai-lieu-the": ["tags"],
  "tai-lieu-luot-tai": ["downloadLimit"],
} as const satisfies Record<string, readonly string[]>;
type SectionId = keyof typeof SECTION_FIELDS;

function sectionOfField(field: string): SectionId | null {
  for (const [id, fields] of Object.entries(SECTION_FIELDS) as [SectionId, readonly string[]][]) {
    if (fields.includes(field)) return id;
  }
  return null;
}

/** ADR-038 mục 7: thông điệp khi bấm Xuất bản mà chưa tích ô cam kết bản quyền. */
const RIGHTS_REQUIRED_MESSAGE = "Hãy tích ô cam kết bản quyền trước khi xuất bản.";

export interface EditorProduct {
  id: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  /** Mô tả ngắn văn bản thuần (ADR-027 §2); chuỗi rỗng = chưa có. */
  summary: string;
  description: string;
  type: string;
  categoryId: string | null;
  tags: string[];
  priceVnd: number;
  /** chuỗi rỗng = chưa đặt giá khuyến mãi */
  salePriceVnd: string;
  /** "YYYY-MM-DDTHH:mm" giờ Việt Nam hoặc chuỗi rỗng */
  saleStartsAt: string;
  saleEndsAt: string;
  downloadLimit: number;
  /** Ảnh bìa Cloudinary đã lưu (giá trị field `coverImageUrl`); chuỗi rỗng = chưa có. */
  coverImageUrl: string;
  /** ADR-038: khác null = bị quản trị hệ thống lưu trữ do vi phạm — không khôi phục/xuất bản được. */
  moderationLock?: ModerationLock | null;
}

export interface EditorPublish {
  allowed: boolean;
  checklist: { requirement: string; label: string; passed: boolean; message?: string }[];
}

/** Thông báo khi thêm tài liệu trên trang Tạo mà chưa có tiêu đề (sửa đổi ADR-027 §4). */
const TITLE_GATE_MESSAGE = "Nhập tiêu đề trước khi thêm tài liệu";

/** Kết quả lần lưu đầu ở trang Tạo — trang Sửa nhận qua query `?created=` (ADR-027 §4). */
export type CreatedNotice = "draft" | "published" | "blocked";

type EditorProps = {
  tenantSlug: string;
  header: ReactNode;
  categories: { id: string; name: string }[];
  allowedHosts: string[];
} & (
  | {
      mode: "create";
      /** ADR-032: lượt tải mặc định hệ thống (System Center, 0 = không giới hạn) — Phong dùng làm defaultValue ô downloadLimit. */
      defaultDownloadLimit?: number;
    }
  | {
      mode: "edit";
      product: EditorProduct;
      currentCategory: { id: string; name: string; isActive: boolean } | null;
      files: EditorFile[];
      links: EditorLink[];
      publish: EditorPublish;
      /** Ảnh bìa R2 cũ đang hiển thị (chỉ khi chưa có ảnh Cloudinary) — null nếu không có. */
      legacyCoverUrl: string | null;
      notice: CreatedNotice | null;
    }
);

/** Nút đã bấm + chế độ hiển thị gửi kèm (null = không gửi `visibility` → chỉ lưu, không đổi trạng thái). */
type SubmitIntent = { key: "primary" | "publish" | "draft" | "preview"; visibility: Visibility | null };

const vnd = new Intl.NumberFormat("vi-VN");

function countChars(value: string): number {
  return Array.from(value).length;
}

/**
 * Editor Tạo/Sửa sản phẩm dùng chung (ADR-026 §5 + ADR-027). Bố cục:
 * - ≥ xl: full width theo khung app (quy tắc 2026-10-25); cột chính `minmax(0,1fr)` (Thông tin → Giá → Ảnh → Tệp) +
 *   sidebar 360px sát phải. Card xuất bản (PublishCard: hiển thị → checklist → trạng thái lưu → nút) đứng đầu
 *   sidebar và dính khi cuộn; các card thuộc tính còn lại cuộn bình thường (trượt dưới card xuất bản).
 * - < xl: 1 cột; card xuất bản ở CUỐI form (đúng trình tự điền → lưu), kèm thanh lưu nhanh dính đáy chỉ hiện khi
 *   có thay đổi/kết quả lưu và khối nút của card chưa trong tầm nhìn.
 * DOM: sidebar = [card thuộc tính..., card xuất bản] (thứ tự đọc: điền hết rồi mới lưu); ≥ xl card xuất bản được
 * đưa lên đầu bằng `order` — focus vào card thuộc tính bị card dính che thì tự cuộn lộ ra (WCAG 2.4.11).
 * FormData giữ đúng tên field của Server Action; submit thủ công (startTransition) để form KHÔNG tự reset khi
 * lưu lỗi (hành vi mặc định của `<form action>` trong React 19 làm mất dữ liệu đã gõ).
 *
 * Nút hành động:
 * - Chưa công khai (trang Tạo / DRAFT): nút chính "Xuất bản" (gửi PUBLIC) + nút phụ "Lưu nháp" (gửi PRIVATE) luôn
 *   hiện — gửi theo NÚT được bấm, radio chỉ phản ánh lựa chọn và được đồng bộ khi bấm nút. Enter trong ô nhập =
 *   Lưu nháp ("Lưu nháp" là nút submit mặc định, "Xuất bản" là type="button") → không vô tình xuất bản.
 * - PUBLISHED: nút chính theo radio ("Lưu thay đổi" / "Lưu & chuyển Riêng tư" có xác nhận). ARCHIVED: "Lưu thay đổi".
 *
 * Trang Tạo — bản nháp tự động (sửa đổi ADR-027 §4): card Tệp tài liệu mở sẵn. Lần thêm file/link đầu tiên gọi
 * `ensureProductId()` → `createProductAction` (PRIVATE, dữ liệu form hiện tại; một promise dùng chung cho mọi lời gọi
 * đồng thời). Thành công: lưu id vào state `draftId` — editor chuyển sang hành vi trang Sửa DRAFT NGAY TRÊN component
 * này (không remount → không ngắt upload). URL GIỮ `/products/new` (không lách `history` của Next): Server Action có
 * revalidate chỉ render lại cùng route trang Tạo nên React giữ nguyên state client. Danh sách file/link giữ cục bộ
 * trong card (từ dữ liệu `complete` / action link trả về); checklist điều kiện chỉ có từ loader trang Sửa → ẩn
 * cho tới khi sang trang Sửa (sau lần Lưu nháp/Xuất bản kế tiếp khi không còn file đang tải, hoặc tải lại trang).
 */
export function ProductEditor(props: EditorProps) {
  const { tenantSlug, header, categories, allowedHosts } = props;
  const isEdit = props.mode === "edit";
  const product = isEdit ? props.product : null;
  // Trang Tạo: id bản nháp tự tạo khi thêm tài liệu lần đầu (null = chưa tạo).
  const [draftId, setDraftId] = useState<string | null>(null);
  const productId = product?.id ?? draftId;
  const inDraftSession = !isEdit && draftId !== null;
  // Bản nháp tự tạo mà người dùng Xuất bản khi còn file đang tải (ở lại trang): theo dõi trạng thái thật từ kết quả lưu.
  const [draftPublished, setDraftPublished] = useState(false);
  const status = product?.status ?? (draftId ? (draftPublished ? "PUBLISHED" : "DRAFT") : null);
  const notice = isEdit ? props.notice : null;
  // ADR-032: trang Tạo dùng lượt tải mặc định hệ thống làm giá trị ban đầu; trang Sửa giữ giá trị của sản phẩm.
  const systemDownloadLimit = isEdit ? undefined : props.defaultDownloadLimit;

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInView, setActionsInView] = useState(false);
  const intentRef = useRef<SubmitIntent>({ key: "primary", visibility: null });
  const previewWinRef = useRef<Window | null>(null);

  const statusVisibility: Visibility = status === "PUBLISHED" ? "PUBLIC" : "PRIVATE";
  const [visibility, setVisibility] = useState<Visibility>(statusVisibility);
  // ADR-038 mục 7: ô cam kết bản quyền — phải tích lại MỖI lần xuất bản (bỏ tích khi trạng thái đổi).
  const [rightsChecked, setRightsChecked] = useState(false);
  const [rightsError, setRightsError] = useState<string | null>(null);
  // Đồng bộ radio với trạng thái thật mỗi khi server trả trạng thái mới (sau lưu / đổi trạng thái).
  const [syncedStatus, setSyncedStatus] = useState(status);
  if (status !== syncedStatus) {
    setSyncedStatus(status);
    setVisibility(statusVisibility);
    setRightsChecked(false);
    setRightsError(null);
  }
  const moderationLock = product?.moderationLock ?? null;

  const [dirty, setDirty] = useState(false);
  // ADR-058 (task 2.3a): field đã sửa kể từ lần lưu gần nhất — CHỈ để hiện badge "Có thay đổi" theo khối. `dirty` vẫn là
  // nguồn sự thật (lưu/tự lưu nháp dựa vào nó); tập này tự xoá khi `dirty` về false nên không phải sửa các chỗ setDirty(false).
  const [changedFields, setChangedFields] = useState<ReadonlySet<string>>(() => new Set());
  const [prevDirty, setPrevDirty] = useState(dirty);
  if (dirty !== prevDirty) {
    setPrevDirty(dirty);
    if (!dirty) setChangedFields(new Set());
  }
  const touchField = (name: string) => setChangedFields((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
  const [pendingKey, setPendingKey] = useState<SubmitIntent["key"] | null>(null);
  const [summaryText, setSummaryText] = useState(product?.summary ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(product?.coverImageUrl ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(String(product?.priceVnd ?? 0));

  // --- Bản nháp tự động ở trang Tạo (sửa đổi ADR-027 §4) ---
  const productIdRef = useRef<string | null>(product?.id ?? null);
  const draftPromiseRef = useRef<Promise<EnsureProductResult> | null>(null);
  const [draftPhase, setDraftPhase] = useState<"idle" | "creating" | "created">("idle");
  /** Kết quả lỗi của lần tạo bản nháp — hiển thị như lỗi lưu thường (tóm tắt lỗi + lỗi từng ô). */
  const [draftState, setDraftState] = useState<ProductActionState | null>(null);
  const [titleGate, setTitleGate] = useState(false);
  /** Còn file chờ/đang tải trong card Tệp tài liệu. Ref: đọc trong effect điều hướng mà không làm effect chạy lại. */
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const onUploadingChange = useCallback((value: boolean) => {
    uploadingRef.current = value;
    setUploading(value);
  }, []);

  // ADR-028: ảnh trong mô tả upload vào folder content của tenant, đăng ký để tính hạn mức ảnh.
  const descriptionImageUpload = useMemo<TiptapImageUpload>(
    () => ({
      getSignature: () => getContentImageUploadSignatureAction(tenantSlug),
      register: (publicId) => registerTenantImageAction(tenantSlug, publicId, "CONTENT"),
      upgradeHref: `/studio/${tenantSlug}/billing`,
    }),
    [tenantSlug],
  );
  const previewHref = (id: string) => `/studio/${tenantSlug}/products/${id}/preview`;

  const [state, dispatch, isPending] = useActionState(async (prev: ProductActionState, fd: FormData): Promise<ProductActionState> => {
    const intent = intentRef.current;
    const result = productId ? await updateProductAction(tenantSlug, productId, prev, fd) : await createProductAction(tenantSlug, prev, fd);
    const savedId = result.productId ?? productId;
    const saved = Boolean((result.ok || result.saved) && savedId);
    if (saved) setDirty(false);
    if (!isEdit && typeof result.published === "boolean") setDraftPublished(result.published);
    // Không công khai được → sản phẩm vẫn Riêng tư: đưa radio về đúng thực tế.
    if (result.publishReasons?.length) setVisibility("PRIVATE");
    if (intent.key === "preview") {
      const win = previewWinRef.current;
      previewWinRef.current = null;
      if (saved && win && !win.closed) win.location.href = previewHref(savedId!);
      else if (!saved) win?.close();
    }
    setPendingKey(null);
    return result;
  }, {});

  // Trang Tạo: lưu xong → sang trang Sửa của bản vừa tạo, kèm kết quả để trang Sửa báo lại (và có checklist từ loader).
  // Đang có file tải lên (bản nháp tự tạo) → Ở LẠI trang hiện tại, không remount để không ngắt upload; kết quả lưu
  // hiện ngay trong card xuất bản.
  useEffect(() => {
    if (isEdit || !state.productId || !(state.ok || state.saved)) return;
    if (uploadingRef.current) return;
    const created: CreatedNotice = state.published ? "published" : state.publishReasons?.length ? "blocked" : "draft";
    router.replace(`/studio/${tenantSlug}/products/${state.productId}?created=${created}`);
  }, [state, router, tenantSlug, isEdit]);

  // Trang Sửa mở từ trang Tạo: gỡ `?created=` khỏi URL (tải lại không lặp thông báo); chưa công khai được →
  // đưa focus tới checklist điều kiện.
  useEffect(() => {
    if (!notice) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (notice === "blocked") publishRef.current?.focus();
  }, [notice]);

  // Quản lý focus sau submit: bị chặn công khai → tới checklist; lỗi lưu → tới tóm tắt lỗi đầu form.
  useEffect(() => {
    if (state.publishReasons && state.publishReasons.length > 0 && publishRef.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      publishRef.current.focus({ preventScroll: true });
      publishRef.current.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    } else if ((state.fieldErrors || state.error) && summaryRef.current) {
      summaryRef.current.focus();
    }
  }, [state]);

  // Lỗi khi tự tạo bản nháp (ngoài lỗi thiếu tiêu đề) → đưa focus tới tóm tắt lỗi như lưu thường.
  useEffect(() => {
    if (draftState && (draftState.fieldErrors || draftState.error)) summaryRef.current?.focus();
  }, [draftState]);

  // Cảnh báo khi rời trang còn thay đổi chưa lưu hoặc còn file đang tải — provider của layout (ADR-058 mục 5): beforeunload
  // chung + chặn điều hướng client (sidebar, tab, "Về trang chủ").
  useUnsavedChanges(
    dirty || uploading,
    uploading ? "Còn file đang tải lên — rời trang sẽ dừng tải. Vẫn rời trang?" : "Tài liệu có thay đổi chưa lưu. Rời trang và bỏ thay đổi?",
  );

  // Thanh lưu nhanh (< xl) ẩn khi khối nút của card xuất bản đang trong tầm nhìn — tránh hai nút Lưu cạnh nhau.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setActionsInView(entries[entries.length - 1]?.isIntersecting ?? false));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [, startSubmit] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);

  /**
   * Đảm bảo đã có sản phẩm để gắn file/link. Trang Sửa / đã có bản nháp → trả id ngay. Trang Tạo lần đầu → kiểm tra
   * tiêu đề (bắt buộc duy nhất để tạo nháp) và ràng buộc HTML của form, rồi `createProductAction` với dữ liệu form
   * hiện tại + `visibility=PRIVATE`. Mọi lời gọi trong lúc đang tạo dùng chung một promise → chỉ một bản nháp.
   */
  function ensureProductId(): Promise<EnsureProductResult> {
    const existing = productIdRef.current;
    if (existing) return Promise.resolve({ ok: true, productId: existing });
    if (draftPromiseRef.current) return draftPromiseRef.current;

    const form = formRef.current;
    const titleInput = form?.elements.namedItem("title");
    if (!form || !(titleInput instanceof HTMLInputElement) || titleInput.value.trim() === "") {
      setTitleGate(true);
      if (titleInput instanceof HTMLInputElement) titleInput.focus();
      return Promise.resolve({ ok: false, error: `${TITLE_GATE_MESSAGE}, rồi bấm Thử lại.` });
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return Promise.resolve({ ok: false, error: "Có ô thông tin chưa hợp lệ — sửa lại rồi bấm Thử lại." });
    }

    const fd = new FormData(form);
    fd.set("visibility", "PRIVATE");
    setDraftPhase("creating");
    setDraftState(null);
    const failed = (result: ProductActionState): EnsureProductResult => {
      draftPromiseRef.current = null;
      setDraftPhase("idle");
      setDraftState(result);
      return { ok: false, error: "Chưa tạo được bản nháp — sửa các mục báo lỗi ở đầu trang rồi thử lại." };
    };
    const promise = createProductAction(tenantSlug, {}, fd).then(
      (result): EnsureProductResult => {
        const id = result.productId;
        if (!id || !(result.ok || result.saved)) return failed(result.error || result.fieldErrors ? result : { error: "Không tạo được bản nháp." });
        productIdRef.current = id;
        setDraftId(id);
        setDraftPhase("created");
        setDirty(false);
        return { ok: true, productId: id };
      },
      () => failed({ error: "Không tạo được bản nháp. Kiểm tra kết nối mạng rồi thử lại." }),
    );
    draftPromiseRef.current = promise;
    return promise;
  }

  function runStatus(kind: "archive" | "restore" | "delete") {
    if (!productId) return;
    const confirmText: Record<typeof kind, string> = {
      archive: "Lưu trữ sản phẩm? Nếu tài liệu chưa có người mua, hệ thống sẽ thực hiện xoá và giải phóng file trong bộ nhớ lưu trữ. Tài liệu đã có người mua sẽ được lưu trữ an toàn.",
      restore: "Khôi phục sản phẩm về chế độ Riêng tư?",
      delete: "Xoá vĩnh viễn tài liệu này? Toàn bộ dữ liệu và file trong bộ lưu trữ sẽ bị xoá hoàn toàn nếu tài liệu chưa có người mua.",
    };
    const extra = dirty ? "\n\nLưu ý: các thay đổi chưa lưu trong form sẽ không được lưu kèm." : "";
    if (!window.confirm(confirmText[kind] + extra)) return;
    setStatusError(null);
    const action = kind === "archive" ? archiveProductAction : kind === "restore" ? restoreProductAction : deleteProductAction;
    startStatus(async () => {
      const result = await action(tenantSlug, productId);
      if (result.error) {
        setStatusError(result.error);
      } else if (result.deleted) {
        router.push(`/studio/${tenantSlug}/products`);
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  /** Gửi form với ý định cho trước. Trả false nếu trình duyệt chặn vì ô bắt buộc còn trống. */
  function submitWith(intent: SubmitIntent): boolean {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return false;
    const fd = new FormData(form);
    fd.delete("visibility");
    if (intent.visibility) fd.set("visibility", intent.visibility);
    intentRef.current = intent;
    setDraftState(null);
    setPendingKey(intent.key);
    startSubmit(() => dispatch(fd));
    return true;
  }

  // Chưa công khai (trang Tạo / DRAFT): gửi theo nút bấm, không theo radio.
  const unpublished = status === null || status === "DRAFT";
  // ARCHIVED: không gửi visibility (chỉ lưu nội dung). PUBLISHED: gửi đúng radio.
  const primaryVisibility: Visibility | null = status === "ARCHIVED" ? null : visibility;

  /** Chưa công khai: bấm nút → đồng bộ radio theo nút rồi gửi. Xuất bản cần tích ô cam kết bản quyền (ADR-038). */
  function submitUnpublished(target: Visibility) {
    setVisibility(target);
    if (target === "PUBLIC" && !rightsChecked) {
      setRightsError(RIGHTS_REQUIRED_MESSAGE);
      document.getElementById("rightsConfirmed")?.focus();
      return;
    }
    submitWith({ key: target === "PUBLIC" ? "publish" : "draft", visibility: target });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Submit mặc định khi chưa công khai (Enter trong ô nhập, nút "Lưu nháp", thanh lưu nhanh) = Lưu nháp.
    if (unpublished) {
      submitUnpublished("PRIVATE");
      return;
    }
    if (status === "PUBLISHED" && visibility === "PRIVATE") {
      const ok = window.confirm("Chuyển sang Riêng tư? Tài liệu sẽ ẩn khỏi trang bán cho tới khi bạn Công khai lại.");
      if (!ok) return;
    }
    submitWith({ key: "primary", visibility: primaryVisibility });
  }

  /** Trang Tạo: lưu nháp rồi mở bản xem trước ở tab mới. Tab được mở NGAY trong cú bấm (tránh chặn popup),
   *  điền URL sau khi lưu xong; lưu lỗi → đóng tab, lỗi hiện trên form như bình thường. */
  function previewFromCreate() {
    if (!formRef.current?.reportValidity()) return;
    const win = window.open("", "_blank");
    if (win) {
      win.opener = null;
      win.document.title = "Đang mở bản xem trước...";
    }
    previewWinRef.current = win;
    submitWith({ key: "preview", visibility: "PRIVATE" });
  }

  function markDirty(target: EventTarget) {
    const el = target as HTMLInputElement;
    if (el.form === formRef.current && PRODUCT_FIELDS.has(el.name)) {
      setDirty(true);
      touchField(el.name);
    }
    if (titleGate && el.name === "title" && el.value.trim() !== "") setTitleGate(false);
  }

  // Lỗi đang hiển thị: của lần tự tạo bản nháp (nếu vừa xảy ra) hoặc của lần lưu gần nhất.
  const shown = draftState ?? state;
  const fieldErrors = shown.fieldErrors ?? {};
  const errorEntries = Object.entries(fieldErrors);
  const showSummary = !shown.publishReasons?.length && (errorEntries.length > 0 || Boolean(shown.error));
  const titleError = fieldErrors.title ?? (titleGate ? TITLE_GATE_MESSAGE : undefined);
  const priceNumber = Number(price);
  const inactiveCategory = isEdit && props.currentCategory && !props.currentCategory.isActive ? props.currentCategory : null;

  // Badge từng khối thu gọn: "N lỗi" > "Có thay đổi" > tóm tắt giá trị (thấy được cả khi thu gọn).
  const sectionErrors = (id: SectionId) => SECTION_FIELDS[id].filter((field) => fieldErrors[field]).length;
  const sectionDirty = (id: SectionId) => dirty && SECTION_FIELDS[id].some((field) => changedFields.has(field));
  const blockStatus = (id: SectionId, summary?: SectionStatus): SectionStatus => {
    const errors = sectionErrors(id);
    if (errors > 0 || sectionDirty(id) || !summary) return sectionStatus({ errorCount: errors, dirty: sectionDirty(id) });
    return summary;
  };
  const priceSummary: SectionStatus | undefined =
    Number.isFinite(priceNumber) && price !== "" ? { tone: "neutral", label: priceNumber === 0 ? "Miễn phí" : `${vnd.format(priceNumber)} ₫` } : undefined;
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? (inactiveCategory?.id === categoryId ? inactiveCategory.name : undefined);
  const categorySummary: SectionStatus = categoryName ? { tone: "neutral", label: categoryName } : { tone: "warning", label: "Chưa chọn danh mục" };
  const creatingDraft = draftPhase === "creating";
  const busy = isPending || statusPending || creatingDraft;
  const hasResult = Object.keys(state).length > 0;
  const summaryCount = countChars(summaryText);

  // Nhãn nút chính: chưa công khai → "Xuất bản"; PUBLISHED theo radio; ARCHIVED chỉ lưu nội dung.
  let primaryLabel: string;
  if (status === "ARCHIVED") primaryLabel = "Lưu thay đổi";
  else if (status === "PUBLISHED") primaryLabel = visibility === "PUBLIC" ? "Lưu thay đổi" : "Lưu & chuyển Riêng tư";
  else primaryLabel = "Xuất bản";
  // Nút phụ "Lưu nháp" luôn hiện khi chưa công khai (PUBLISHED không có — tránh gỡ xuất bản ngoài ý muốn).
  const showDraftButton = unpublished;
  const draftPending = isPending && pendingKey === "draft";

  let barMessage: ReactNode;
  if (isPending) barMessage = pendingKey === "preview" ? "Đang lưu nháp để mở bản xem trước..." : "Đang lưu...";
  else if (statusPending) barMessage = "Đang cập nhật trạng thái...";
  else if (statusError) barMessage = <span style={{ color: RED }}>{statusError}</span>;
  else if (dirty)
    barMessage = (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-2 font-semibold" style={{ color: AMBER }}>
          <span className="h-2 w-2 rounded-full" style={{ background: AMBER }} aria-hidden="true" />
          Có thay đổi chưa lưu
        </span>
        {isEdit ? <span className="text-xs">· Xem trước hiển thị bản đã lưu</span> : null}
      </span>
    );
  else if (state.saved && state.publishReasons?.length)
    barMessage = <span style={{ color: AMBER }}>Đã lưu ở chế độ Riêng tư — chưa đủ điều kiện công khai.</span>;
  else if (state.published === true) barMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu — tài liệu đang Công khai.</span>;
  else if (state.published === false) barMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu ở chế độ Riêng tư.</span>;
  else if (state.ok && productId) barMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu thay đổi.</span>;
  else if (!isEdit) barMessage = "Tài liệu mới được lưu Riêng tư cho tới khi bạn bấm Xuất bản.";
  else barMessage = "Mọi thay đổi đã được lưu.";

  // Bản rút gọn cho thanh lưu nhanh (< xl). Chỉ để nhìn — vùng aria-live duy nhất nằm trong card xuất bản.
  let quickMessage: ReactNode = null;
  if (creatingDraft) quickMessage = "Đang tạo bản nháp...";
  else if (isPending || statusPending) quickMessage = "Đang lưu...";
  else if (dirty)
    quickMessage = (
      <span className="inline-flex items-center gap-2 font-semibold" style={{ color: AMBER }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AMBER }} />
        Có thay đổi chưa lưu
      </span>
    );
  else if (state.saved && state.publishReasons?.length) quickMessage = <span style={{ color: AMBER }}>Đã lưu Riêng tư — chưa đủ điều kiện công khai.</span>;
  else if (state.ok || state.saved) quickMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu.</span>;
  const showQuickBar = !actionsInView && (dirty || busy || hasResult);

  const actionButtons = (
    <div className="space-y-2">
      {unpublished && moderationLock ? null : unpublished ? (
        // type="button": Enter trong ô nhập không kích hoạt nút này (submit mặc định = Lưu nháp).
        <button
          type="button"
          onClick={() => submitUnpublished("PUBLIC")}
          disabled={busy}
          aria-describedby={visibility === "PUBLIC" ? "visibility-publish-hint" : undefined}
          className={`${PRIMARY_BTN} w-full`}
          style={{ background: brandColors.primary }}
        >
          {isPending && pendingKey === "publish" ? "Đang xuất bản..." : primaryLabel}
        </button>
      ) : (
        <button type="submit" disabled={busy} className={`${PRIMARY_BTN} w-full`} style={{ background: brandColors.primary }}>
          {isPending && pendingKey === "primary" ? "Đang lưu..." : primaryLabel}
        </button>
      )}
      <div className={`grid gap-2 ${showDraftButton ? "grid-cols-2" : "grid-cols-1"}`}>
        {productId ? (
          <Link
            href={previewHref(productId)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${GHOST_BTN} w-full`}
            style={{ borderColor: GRAY_LINE, color: brandColors.ink }}
          >
            <IconEye className="h-4 w-4" />
            Xem trước
            <span className="sr-only">(bản đã lưu, mở tab mới)</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={previewFromCreate}
            disabled={busy}
            className={`${GHOST_BTN} w-full`}
            style={{ borderColor: GRAY_LINE, color: brandColors.ink }}
          >
            <IconEye className="h-4 w-4" />
            {isPending && pendingKey === "preview" ? "Đang lưu..." : "Xem trước"}
            <span className="sr-only">(lưu nháp rồi mở tab mới)</span>
          </button>
        )}
        {showDraftButton ? (
          // Submit mặc định của form khi chưa công khai (onSubmit → Lưu nháp).
          <button type="submit" disabled={busy} className={`${GHOST_BTN} w-full`} style={{ borderColor: GRAY_LINE, color: brandColors.ink }}>
            {draftPending ? "Đang lưu..." : "Lưu nháp"}
          </button>
        ) : null}
      </div>
    </div>
  );

  const noticeBanner =
    notice && !hasResult ? (
      notice === "blocked" ? (
        <WarningNote title="Đã lưu ở chế độ Riêng tư">
          Tài liệu chưa đủ điều kiện công khai. Hoàn thành các mục còn thiếu trong “Chế độ hiển thị”, rồi bấm Xuất bản.
        </WarningNote>
      ) : (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
          style={{ background: GREEN_SOFT, borderColor: GREEN_LINE, color: GREEN_TEXT }}
        >
          <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {notice === "published"
              ? "Đã tạo và công khai tài liệu."
              : "Đã lưu bản nháp (Riêng tư). Bấm Xuất bản khi tài liệu đã sẵn sàng."}
          </span>
        </p>
      )
    ) : null;

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={(e) => markDirty(e.target)}
      className="studio-editor"
      aria-label={isEdit ? "Sửa sản phẩm" : "Tạo sản phẩm"}
    >
      {/* Full width theo khung app (chủ dự án chốt 2026-10-25 — không giới hạn bề ngang nội dung chính). */}
      <div>
        {header}

        {noticeBanner ? <div className="mt-6">{noticeBanner}</div> : null}

        {showSummary ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="product-error-summary-title"
            className="mt-6 rounded-xl border px-4 py-3 text-sm"
            style={{ background: RED_SOFT, borderColor: RED_LINE, color: RED }}
          >
            <h2 id="product-error-summary-title" className="flex items-center gap-2 font-semibold">
              <IconAlertTriangle className="h-4 w-4 shrink-0" />
              {shown.error ?? "Chưa lưu được — vui lòng kiểm tra lại."}
            </h2>
            {errorEntries.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {errorEntries.map(([field, message]) => (
                  <li key={field}>
                    {FIELD_LABEL[field] ? (
                      <a
                        href={`#${field}`}
                        className="underline underline-offset-2"
                        onClick={() => {
                          // Mở khối chứa ô (đồng bộ) trước khi trình duyệt nhảy tới ô — ô trong khối thu gọn đang `hidden`.
                          const section = sectionOfField(field);
                          if (section) revealSection(section);
                        }}
                      >
                        {FIELD_LABEL[field]}: {message}
                      </a>
                    ) : (
                      message
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          {/* Cột chính: Thông tin → Giá → Ảnh → Tệp */}
          <div className="min-w-0 space-y-6">
            <CollapsibleSection
              id="tai-lieu-thong-tin"
              defaultOpen
              icon={<IconPackage className="h-5 w-5" />}
              title="Thông tin tài liệu"
              description={isEdit ? undefined : "Có thể sửa lại mọi thứ sau khi lưu."}
              status={blockStatus("tai-lieu-thong-tin")}
              errorCount={sectionErrors("tai-lieu-thong-tin")}
            >
              <div className="space-y-4">
                <TextField
                  id="title"
                  name="title"
                  label="Tiêu đề (bắt buộc)"
                  defaultValue={product?.title ?? ""}
                  required
                  maxLength={200}
                  error={titleError}
                />
                {isEdit ? (
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: brandColors.ink }}>
                      Đường dẫn
                    </p>
                    <p
                      className="mt-1.5 rounded-lg border bg-gray-50 px-3.5 py-2.5 text-[15px] [overflow-wrap:anywhere]"
                      style={{ borderColor: GRAY_LINE, color: brandColors.ink }}
                    >
                      {productPath(tenantSlug, product!.slug)}
                    </p>
                    <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                      Đường dẫn cố định sau khi tạo.
                    </p>
                  </div>
                ) : inDraftSession ? (
                  // Bản nháp đã tạo: đường dẫn đã cố định (Server Action cập nhật không nhận slug) → chỉ đọc.
                  <TextField
                    id="slug"
                    name="slug"
                    label="Đường dẫn"
                    readOnly
                    placeholder="đã tự sinh từ tiêu đề"
                    hint="Đã cố định khi tạo bản nháp — không sửa được."
                    style={{ borderColor: GRAY_LINE, background: "#F9FAFB", color: brandColors.inkSoft }}
                  />
                ) : (
                  <TextField
                    id="slug"
                    name="slug"
                    label="Đường dẫn (tuỳ chọn)"
                    placeholder="để trống sẽ tự sinh từ tiêu đề"
                    hint="Chữ thường không dấu, số, dấu gạch ngang. Không đổi được sau khi tạo."
                    error={fieldErrors.slug}
                  />
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="summary" className="block text-sm font-medium" style={{ color: brandColors.ink }}>
                    Mô tả ngắn
                  </label>
                  <span
                    id="summary-count"
                    className="shrink-0 text-xs tabular-nums"
                    style={{ color: summaryCount >= PRODUCT_SUMMARY_MAX_LENGTH ? AMBER : INK_SOFT }}
                  >
                    {summaryCount}/{PRODUCT_SUMMARY_MAX_LENGTH}
                    <span className="sr-only"> ký tự</span>
                  </span>
                </div>
                <textarea
                  id="summary"
                  name="summary"
                  rows={2}
                  maxLength={PRODUCT_SUMMARY_MAX_LENGTH}
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  aria-describedby={fieldErrors.summary ? "summary-error summary-count" : "summary-hint summary-count"}
                  aria-invalid={fieldErrors.summary ? true : undefined}
                  placeholder="Một đến hai câu giới thiệu: tài liệu gì, dành cho ai."
                  className="mt-1.5 block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
                  style={{ borderColor: fieldErrors.summary ? RED : GRAY_LINE }}
                />
                {fieldErrors.summary ? (
                  <p id="summary-error" role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
                    {fieldErrors.summary}
                  </p>
                ) : (
                  <p id="summary-hint" className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                    Hiện trên thẻ tài liệu và đầu trang chi tiết. Văn bản thuần, không định dạng.
                  </p>
                )}
              </div>

              <div id="description" tabIndex={-1} className="outline-none">
                <span className="block text-sm font-medium" style={{ color: brandColors.ink }}>
                  Mô tả chi tiết
                </span>
                <input type="hidden" name="description" value={description} />
                <div className="mt-1.5">
                  <TiptapEditor
                    content={description}
                    onChange={(html) => {
                      setDescription(html);
                      setDirty(true);
                      touchField("description");
                    }}
                    placeholder="Nội dung tài liệu, dành cho ai, định dạng file, cách sử dụng..."
                    imageUpload={descriptionImageUpload}
                  />
                </div>
                {fieldErrors.description ? (
                  <p role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
                    {fieldErrors.description}
                  </p>
                ) : null}
              </div>
            </CollapsibleSection>

            {/* Trang Tạo mở sẵn: giá mặc định 0 = miễn phí, ẩn đi dễ xuất bản nhầm tài liệu miễn phí. */}
            <CollapsibleSection
              id="tai-lieu-gia"
              defaultOpen={!isEdit}
              icon={<IconCard className="h-5 w-5" />}
              title="Giá & khuyến mãi"
              description="Số nguyên, đơn vị đồng, không dấu chấm. Giá gốc 0 = miễn phí."
              status={blockStatus("tai-lieu-gia", priceSummary)}
              errorCount={sectionErrors("tai-lieu-gia")}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  id="priceVnd"
                  name="priceVnd"
                  label="Giá gốc (VND)"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  error={fieldErrors.priceVnd}
                  hint={
                    Number.isFinite(priceNumber) && price !== ""
                      ? priceNumber === 0
                        ? "Khách thấy: Miễn phí"
                        : `Khách thấy: ${vnd.format(priceNumber)} ₫`
                      : "Nhập số nguyên, không dấu chấm. 0 = miễn phí."
                  }
                />
                <TextField
                  id="salePriceVnd"
                  name="salePriceVnd"
                  label="Giá khuyến mãi (VND, tuỳ chọn)"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  defaultValue={product?.salePriceVnd ?? ""}
                  error={fieldErrors.salePriceVnd}
                  hint="Phải nhỏ hơn giá gốc. Để trống nếu không áp dụng."
                />
              </div>
              <fieldset className="rounded-xl border px-4 pt-2 pb-4" style={{ borderColor: GRAY_LINE }}>
                <legend className="px-1 text-sm font-semibold" style={{ color: brandColors.ink }}>
                  Thời gian khuyến mãi (tuỳ chọn)
                </legend>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    id="saleStartsAt"
                    name="saleStartsAt"
                    label="Bắt đầu (giờ Việt Nam)"
                    type="datetime-local"
                    defaultValue={product?.saleStartsAt ?? ""}
                    error={fieldErrors.saleStartsAt}
                  />
                  <TextField
                    id="saleEndsAt"
                    name="saleEndsAt"
                    label="Kết thúc (giờ Việt Nam)"
                    type="datetime-local"
                    defaultValue={product?.saleEndsAt ?? ""}
                    error={fieldErrors.saleEndsAt}
                  />
                </div>
                <p className="mt-3 text-xs" style={{ color: INK_SOFT }}>
                  Để trống thời gian = áp dụng ngay và không hết hạn.
                </p>
              </fieldset>
            </CollapsibleSection>

            <CoverImageCard
              tenantSlug={tenantSlug}
              value={coverImageUrl}
              onChange={(url) => {
                setCoverImageUrl(url);
                setDirty(true);
              }}
              legacyUrl={isEdit ? props.legacyCoverUrl : null}
              error={fieldErrors.coverImageUrl}
            />

            <DeliverySourcesCard
              tenantSlug={tenantSlug}
              productId={productId}
              files={isEdit ? props.files : []}
              links={isEdit ? props.links : []}
              allowedHosts={allowedHosts}
              sync={isEdit ? "server" : "local"}
              ensureProductId={ensureProductId}
              onUploadingChange={onUploadingChange}
              status={
                creatingDraft ? (
                  "Đang tạo bản nháp để thêm tài liệu…"
                ) : draftPhase === "created" ? (
                  <span className="inline-flex items-center gap-2" style={{ color: GREEN_TEXT }}>
                    <IconCheckCircle className="h-4 w-4 shrink-0" />
                    Đã lưu bản nháp (Riêng tư) — tài liệu được thêm vào bản nháp này.
                  </span>
                ) : null
              }
            />
          </div>

          {/* Sidebar: DOM = [thuộc tính..., xuất bản] (điền rồi mới lưu); ≥ xl card xuất bản lên đầu (không dính khi cuộn — ADR-030). */}
          <aside aria-label="Thuộc tính và xuất bản tài liệu" className="flex min-w-0 flex-col gap-6">
            <div className="space-y-6">
              <CollapsibleSection
                id="tai-lieu-danh-muc"
                icon={<IconTag className="h-5 w-5" />}
                title="Danh mục & loại"
                status={blockStatus("tai-lieu-danh-muc", categorySummary)}
                errorCount={sectionErrors("tai-lieu-danh-muc")}
              >
                {inactiveCategory ? (
                  <WarningNote title="Danh mục hiện tại đã ngừng hoạt động">
                    “{inactiveCategory.name}” không còn được dùng. Hãy chọn danh mục khác thì mới lưu
                    {status === "PUBLISHED" ? "" : " hoặc công khai"} được.
                  </WarningNote>
                ) : null}
                <SelectField
                  id="categoryId"
                  name="categoryId"
                  label="Danh mục tài liệu"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  error={fieldErrors.categoryId}
                  hint={categories.length === 0 ? "Chưa có danh mục nào đang hoạt động — liên hệ quản trị hệ thống." : "Bắt buộc khi Công khai."}
                >
                  <option value="">— Chưa chọn —</option>
                  {inactiveCategory ? (
                    <option value={inactiveCategory.id} disabled>
                      {inactiveCategory.name} (đã ngừng hoạt động)
                    </option>
                  ) : null}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField id="type" name="type" label="Loại tài liệu" defaultValue={product?.type ?? "OTHER"} error={fieldErrors.type}>
                  {Object.entries(PRODUCT_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </CollapsibleSection>

              <CollapsibleSection
                id="tai-lieu-the"
                icon={<IconTag className="h-5 w-5" />}
                title="Thẻ"
                status={blockStatus("tai-lieu-the")}
                errorCount={sectionErrors("tai-lieu-the")}
              >
                <TagInput
                  id="tags"
                  name="tags"
                  label="Cấp học, môn học, chủ đề"
                  initial={product?.tags ?? []}
                  onChange={() => {
                    setDirty(true);
                    touchField("tags");
                  }}
                  error={fieldErrors.tags}
                  hint="Nhấn Enter hoặc dấu phẩy để thêm thẻ."
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="tai-lieu-luot-tai"
                icon={<IconDoc className="h-5 w-5" />}
                title="Giới hạn lượt tải"
                status={blockStatus("tai-lieu-luot-tai")}
                errorCount={sectionErrors("tai-lieu-luot-tai")}
              >
                <TextField
                  id="downloadLimit"
                  name="downloadLimit"
                  label="Số lượt tải tối đa mỗi khách"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000}
                  step={1}
                  defaultValue={product?.downloadLimit ?? systemDownloadLimit ?? 0}
                  error={fieldErrors.downloadLimit}
                  hint={
                    systemDownloadLimit !== undefined
                      ? `Mặc định hệ thống: ${vnd.format(systemDownloadLimit)} (0 = không giới hạn). Tối đa 1000. Áp dụng cho cả file và link.`
                      : "0 = không giới hạn. Tối đa 1000. Áp dụng cho cả file và link."
                  }
                />
              </CollapsibleSection>

              {productId ? (
                <CollapsibleSection
                  id="tai-lieu-link-chia-se"
                  icon={<IconExternalLink className="h-5 w-5" />}
                  title="Link chia sẻ private"
                  description="Tạo link tải riêng cho một người, không cần đăng nhập."
                >
                  <Link
                    href={`/studio/${tenantSlug}/products/${productId}/share-links`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold sm:min-h-8"
                    style={{ color: brandColors.primary }}
                  >
                    Quản lý link chia sẻ <IconExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </CollapsibleSection>
              ) : null}
            </div>

            {/* Card xuất bản: ≥ xl lên đầu sidebar, cuộn theo trang như các card khác. */}
            <div className="xl:order-first">
                <PublishCard
                  containerRef={publishRef}
                  value={visibility}
                  onChange={(next) => {
                    setVisibility(next);
                    setDirty(true);
                  }}
                  status={status}
                  checklist={isEdit ? { allowed: props.publish.allowed, items: props.publish.checklist } : null}
                  publishReasons={shown.publishReasons}
                  visibilityError={fieldErrors.visibility}
                  statusMessage={barMessage}
                  actions={actionButtons}
                  actionsRef={actionsRef}
                  busy={busy}
                  publicHref={isEdit ? productPath(tenantSlug, product!.slug) : undefined}
                  onArchive={isEdit && !moderationLock && (status === "DRAFT" || status === "PUBLISHED") ? () => runStatus("archive") : undefined}
                  onRestore={status === "ARCHIVED" && !moderationLock ? () => runStatus("restore") : undefined}
                  onDelete={isEdit && !moderationLock ? () => runStatus("delete") : undefined}
                  moderationLock={moderationLock}
                  rights={
                    unpublished && !moderationLock
                      ? {
                          checked: rightsChecked,
                          onChange: (checked) => {
                            setRightsChecked(checked);
                            if (checked) setRightsError(null);
                          },
                          error: rightsError ?? (rightsChecked ? undefined : fieldErrors.rightsConfirmed),
                        }
                      : undefined
                  }
                />
            </div>
          </aside>
        </div>
      </div>

      {/* Thanh lưu nhanh CHỈ dưới xl (1 cột, card xuất bản ở cuối form): hiện khi có thay đổi/kết quả lưu và khối nút
          của card chưa trong tầm nhìn. `invisible` (không `hidden`) để giữ chỗ — không nhảy layout khi ẩn/hiện.
          globals.css `.studio-save-bar` chừa scroll-padding-bottom để thanh không che phần tử nhận focus. */}
      <div
        className={`studio-save-bar sticky bottom-0 z-20 -mx-5 mt-6 border-t bg-white px-5 pt-3 transition-[opacity,visibility] duration-150 motion-reduce:transition-none lg:-mx-8 lg:px-8 xl:hidden ${showQuickBar ? "visible opacity-100" : "invisible opacity-0"}`}
        data-visible={showQuickBar ? "true" : "false"}
        style={{ borderColor: GRAY_LINE, boxShadow: "0 -6px 16px rgb(18 33 58 / 0.06)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p aria-hidden="true" className="min-w-0 text-sm" style={{ color: INK_SOFT }}>
            {quickMessage}
          </p>
          <button type="submit" disabled={busy} className={`${PRIMARY_BTN} shrink-0`} style={{ background: brandColors.primary }}>
            {unpublished ? (draftPending ? "Đang lưu..." : "Lưu nháp") : isPending && pendingKey === "primary" ? "Đang lưu..." : primaryLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
