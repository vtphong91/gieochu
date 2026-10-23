"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
// Subpath (không qua barrel "@gieochu/core") — barrel kéo theo code server-only (argon2/pino).
import {
  NAV_CHILDREN_MAX,
  NAV_COLUMN_TITLE_MAX,
  NAV_COPYRIGHT_MAX,
  NAV_CTA_LABEL_MAX,
  NAV_FOOTER_COLUMNS_MAX,
  NAV_FOOTER_COLUMNS_MIN,
  NAV_FOOTER_DESCRIPTION_MAX,
  NAV_FOOTER_LINKS_MAX,
  NAV_FOOTER_LINKS_MIN,
  NAV_HEADER_ITEMS_MAX,
  NAV_LABEL_MAX,
  NAV_LINK_KIND_LABELS,
  NAV_LINK_KINDS,
  navTargetError,
  siteMenuSchema,
  type NavLink,
  type NavLinkKind,
  type SiteMenu,
} from "@gieochu/core/site-menu";
import { collectStrings, findContentClaimWarnings } from "@gieochu/core/cms-content-guard";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { SortableListEditor } from "../_ui/sortable-list-editor";
import { Badge, ConfigCard, GhostButton, Notice, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconAlertTriangle, IconCheckCircle, IconExternalLink, IconLayers, IconMenu, IconRoute } from "../../_ui/icons";
import { publishMenuAction, restoreLiveMenuAction, saveMenuDraftAction, type MenuEditorActionState } from "./actions";

/**
 * Editor CMS menu header/footer (ADR-050 mục 1, GĐ2 UI) — cùng pattern editor Cửa hàng/Bảng giá (UI-Design-System §13.3):
 * thông báo trạng thái đầu trang, **thanh trạng thái dính** (huy hiệu + Xem trang / Khôi phục / Lưu nháp / Xuất bản, kết quả
 * `role="status"`/`"alert"` ngay trong thanh), kiểm tra trước khi gửi bằng đúng `siteMenuSchema` (bật sau lần bấm đầu), **khung
 * tóm tắt lỗi** nhận focus — mỗi lỗi là nút nhảy tới đúng ô; lỗi server (`issues[].path`) gộp vào cùng khung. Danh sách
 * mục/menu con/cột/link dùng `SortableListEditor` (Lên/Xuống thay kéo-thả, WCAG 2.5.7). Xác nhận: xoá mục còn nội dung,
 * khôi phục (không hoàn tác), xuất bản khi còn cảnh báo nội dung. Cảnh báo rời trang khi có thay đổi chưa lưu.
 * Không đổi action/props.
 */

export interface MenuPageOption {
  /** Khoá "trang có sẵn" (`shop`, `pricing`, `cms:<slug>`…). */
  value: string;
  label: string;
  /** false = trang CMS chưa xuất bản (khách sẽ gặp 404). */
  published: boolean;
}

type Status = "NONE" | "DRAFT" | "PUBLISHED";
type PendingAction = "save" | "publish" | "restore";
type EditableLink = Omit<NavLink, "id"> & { id: string };
type MenuIssue = { path: string; message: string };

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BAR_BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`;
const TEXTAREA =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyLink(prefix: string): NavLink {
  return { id: newId(prefix), label: "", kind: "page", target: "home", newTab: false, visible: true };
}

function issuesFromSchema(menu: SiteMenu): MenuIssue[] {
  const parsed = siteMenuSchema.safeParse(menu);
  if (parsed.success) return [];
  return parsed.error.issues.slice(0, 30).map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

/**
 * Đường dẫn lỗi (`header.items.0.children.1.target`…) → id ô cần focus + mô tả vị trí đọc được. Khớp id ô trong form:
 * `hdr-<id>-<field>`, `cta-<field>`, `col-<id>-title`, `foot-<id>-<field>`; lỗi cấp danh sách → nút Thêm `${listId}-add`.
 */
function locateIssue(menu: SiteMenu, path: string): { fieldId: string | null; where: string } {
  const parts = path.split(".");
  const field = (name: string | undefined) => (name === "label" || name === "kind" || name === "target" ? name : "label");
  const fieldName = (name: string | undefined) => (name === "target" ? "Đích" : name === "kind" ? "Loại link" : "Nhãn");
  if (parts[0] === "header" && parts[1] === "items") {
    const index = Number(parts[2]);
    const item = Number.isInteger(index) ? menu.header.items[index] : undefined;
    if (!item) return { fieldId: "menu-header-items-add", where: "Menu đầu trang" };
    if (parts[3] === "children") {
      const childIndex = Number(parts[4]);
      const child = Number.isInteger(childIndex) ? item.children[childIndex] : undefined;
      if (!child) return { fieldId: `menu-children-${item.id}-add`, where: `Menu đầu trang · Mục ${index + 1} · Menu con` };
      return { fieldId: `hdr-${child.id}-${field(parts[5])}`, where: `Menu đầu trang · Mục ${index + 1} · Mục con ${childIndex + 1} · ${fieldName(parts[5])}` };
    }
    return { fieldId: `hdr-${item.id}-${field(parts[3])}`, where: `Menu đầu trang · Mục ${index + 1} · ${fieldName(parts[3])}` };
  }
  if (parts[0] === "header" && parts[1] === "cta") return { fieldId: `cta-${field(parts[2])}`, where: `Nút kêu gọi · ${fieldName(parts[2])}` };
  if (parts[0] === "footer") {
    if (parts[1] === "description") return { fieldId: "footer-description", where: "Chân trang · Mô tả" };
    if (parts[1] === "copyright") return { fieldId: "footer-copyright", where: "Chân trang · Dòng bản quyền" };
    if (parts[1] === "columns") {
      const index = Number(parts[2]);
      const column = Number.isInteger(index) ? menu.footer.columns[index] : undefined;
      if (!column) return { fieldId: "menu-footer-columns-add", where: "Chân trang · Cột" };
      if (parts[3] === "links") {
        const linkIndex = Number(parts[4]);
        const link = Number.isInteger(linkIndex) ? column.links[linkIndex] : undefined;
        if (!link) return { fieldId: `menu-links-${column.id}-add`, where: `Chân trang · Cột ${index + 1} · Link` };
        return { fieldId: `foot-${link.id}-${field(parts[5])}`, where: `Chân trang · Cột ${index + 1} · Link ${linkIndex + 1} · ${fieldName(parts[5])}` };
      }
      return { fieldId: `col-${column.id}-title`, where: `Chân trang · Cột ${index + 1} · Tiêu đề` };
    }
  }
  return { fieldId: null, where: "Menu" };
}

/** Ô của một link: nhãn, loại link, đích, tab mới, ẩn/hiện. `groupMode` = mục có menu con → không cần đích. */
function LinkFields({
  idPrefix,
  link,
  labelMax,
  pageOptions,
  groupMode = false,
  showErrors,
  onChange,
}: {
  idPrefix: string;
  link: EditableLink;
  labelMax: number;
  pageOptions: MenuPageOption[];
  groupMode?: boolean;
  showErrors: boolean;
  onChange: (link: EditableLink) => void;
}) {
  const targetError = groupMode ? null : navTargetError(link.kind, link.target);
  const pageOption = link.kind === "page" ? pageOptions.find((option) => option.value === link.target) : undefined;
  // Lỗi nhãn chỉ hiện sau lần bấm Lưu/Xuất bản đầu (không la lỗi khi vừa thêm mục trống); lỗi đích hiện ngay khi đã gõ.
  const labelError = showErrors && !link.label.trim() ? "Nhập nhãn." : undefined;
  const showTargetError = targetError && (showErrors || (link.kind !== "page" && link.target.trim() !== "" && link.target !== "https://"));

  function changeKind(kind: NavLinkKind) {
    const defaults: Record<NavLinkKind, { target: string; newTab: boolean }> = {
      page: { target: "home", newTab: false },
      internal: { target: "/", newTab: false },
      external: { target: "https://", newTab: true },
      email: { target: "", newTab: false },
    };
    onChange({ ...link, kind, ...defaults[kind] });
  }

  return (
    <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
      <TextField
        id={`${idPrefix}-label`}
        label={`Nhãn (${link.label.length}/${labelMax})`}
        value={link.label}
        maxLength={labelMax}
        error={labelError}
        onChange={(e) => onChange({ ...link, label: e.target.value })}
      />
      {groupMode ? (
        <p className="self-end rounded-lg border border-dashed px-3 py-2.5 text-sm md:mb-0.5" style={{ borderColor: LINE, color: INK_SOFT }}>
          Mục có menu con là <strong>nhóm</strong> — bấm để mở danh sách con, không có đích riêng.
        </p>
      ) : (
        <>
          <SelectField id={`${idPrefix}-kind`} label="Loại link" value={link.kind} onChange={(e) => changeKind(e.target.value as NavLinkKind)}>
            {NAV_LINK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {NAV_LINK_KIND_LABELS[kind]}
              </option>
            ))}
          </SelectField>
          {link.kind === "page" ? (
            <SelectField
              id={`${idPrefix}-target`}
              label="Trang"
              value={link.target}
              error={showTargetError ? (targetError ?? undefined) : undefined}
              hint={pageOption && !pageOption.published ? "Trang này chưa xuất bản — khách sẽ gặp trang 404." : undefined}
              onChange={(e) => onChange({ ...link, target: e.target.value })}
            >
              {pageOption ? null : <option value={link.target}>(trang không còn tồn tại)</option>}
              {pageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.published ? "" : " — chưa xuất bản"}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField
              id={`${idPrefix}-target`}
              label={link.kind === "internal" ? "Đường dẫn (bắt đầu bằng /)" : link.kind === "external" ? "URL (https://…)" : "Địa chỉ email"}
              type={link.kind === "email" ? "email" : link.kind === "external" ? "url" : "text"}
              inputMode={link.kind === "email" ? "email" : "url"}
              autoComplete="off"
              spellCheck={false}
              value={link.target}
              error={showTargetError ? (targetError ?? undefined) : undefined}
              hint={link.kind === "external" ? "Chỉ nhận https://; không dùng link xem trước (*.vercel.app) hay localhost." : undefined}
              onChange={(e) => onChange({ ...link, target: e.target.value })}
            />
          )}
          <label htmlFor={`${idPrefix}-newtab`} className="flex min-h-11 cursor-pointer items-center gap-2.5 self-end text-sm md:mb-0.5" style={{ color: INK }}>
            <input
              id={`${idPrefix}-newtab`}
              type="checkbox"
              className="h-[18px] w-[18px] cursor-pointer accent-[color:var(--brand-primary,#0F3B82)]"
              checked={link.newTab}
              onChange={(e) => onChange({ ...link, newTab: e.target.checked })}
            />
            Mở trong tab mới
          </label>
        </>
      )}
      <div className="flex min-h-11 items-center gap-2 md:col-span-2">
        <Toggle checked={link.visible} aria-label={`Hiển thị ${link.label || "mục này"}`} onChange={(e) => onChange({ ...link, visible: e.target.checked })} />
        {link.visible ? (
          <span className="text-sm" style={{ color: INK }}>
            Đang hiện trên trang
          </span>
        ) : (
          <Badge tone="warning">Đang ẩn — khách không thấy mục này</Badge>
        )}
      </div>
    </div>
  );
}

/** Tên mục để đọc trong danh sách (nút Lên/Xuống/Xoá, thông báo). */
function linkName(prefix: string, label: string, index: number): string {
  return `${prefix} ${index + 1}${label.trim() ? ` — ${label.trim()}` : ""}`;
}

/** Xác nhận khi xoá mục đã có nhãn (hoặc còn mục con) — mục trống xoá ngay. */
function confirmRemoveLink(kind: string, label: string, childCount = 0): string | null {
  if (childCount > 0) return `Xoá ${kind} “${label || "chưa đặt tên"}” cùng ${childCount} mục con?`;
  return label.trim() ? `Xoá ${kind} “${label.trim()}”?` : null;
}

export function MenuEditor({
  initialMenu,
  live,
  initialHasDraft,
  initialStatus,
  updatedAtLabel,
  pageOptions,
}: {
  initialMenu: SiteMenu;
  live: SiteMenu;
  initialHasDraft: boolean;
  initialStatus: Status;
  updatedAtLabel: string | null;
  pageOptions: MenuPageOption[];
}) {
  const [menu, setMenu] = useState<SiteMenu>(initialMenu);
  const [liveMenu, setLiveMenu] = useState<SiteMenu>(live);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialMenu));
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [savedLabel, setSavedLabel] = useState<string | null>(updatedAtLabel);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverIssues, setServerIssues] = useState<MenuIssue[]>([]);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ target: string; seq: number } | null>(null);
  /** Tăng khi khôi phục — buộc form dựng lại (bỏ chuỗi gõ dở). */
  const [formVersion, setFormVersion] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  const isDirty = JSON.stringify(menu) !== savedSnapshot;
  const warnings = useMemo(() => findContentClaimWarnings(collectStrings(menu)), [menu]);
  const clientIssues = attempted ? issuesFromSchema(menu) : [];
  const seenIssues = new Set(clientIssues.map((issue) => `${issue.path}|${issue.message}`));
  const issues = [...clientIssues, ...serverIssues.filter((issue) => !seenIssues.has(`${issue.path}|${issue.message}`))];
  /** id của mục vừa tạo — `SortableListEditor` gọi `create()` rồi mới `focusOnAdd()`, nên đọc id từ ref (không từ state cũ). */
  const lastCreatedId = useRef("");
  function created<T extends { id: string }>(item: T): T {
    lastCreatedId.current = item.id;
    return item;
  }

  const header = menu.header;
  const footer = menu.footer;
  const setHeader = (next: Partial<SiteMenu["header"]>) => setMenu((prev) => ({ ...prev, header: { ...prev.header, ...next } }));
  const setFooter = (next: Partial<SiteMenu["footer"]>) => setMenu((prev) => ({ ...prev, footer: { ...prev.footer, ...next } }));

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "__summary") {
      summaryRef.current?.focus();
      return;
    }
    const el = document.getElementById(focusRequest.target);
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [focusRequest]);

  function requestFocus(target: string) {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }

  function submit(kind: "save" | "publish") {
    setAttempted(true);
    setServerIssues([]);
    if (issuesFromSchema(menu).length > 0) {
      setMessage(null);
      requestFocus("__summary");
      return;
    }
    if (kind === "publish" && warnings.length > 0) {
      const ok = window.confirm(
        `Còn ${warnings.length} cảnh báo nội dung cần xác minh (xem khung vàng). Vẫn xuất bản menu cho mọi trang công khai?`,
      );
      if (!ok) return;
    }
    const submitted = menu;
    const snapshot = JSON.stringify(submitted);
    setPendingAction(kind);
    startTransition(async () => {
      const response: MenuEditorActionState = kind === "save" ? await saveMenuDraftAction(submitted) : await publishMenuAction(submitted);
      if (response.success) {
        setSavedSnapshot(snapshot);
        setSavedLabel(new Date().toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }));
        if (kind === "save") {
          setHasDraft(true);
          setStatus((prev) => (prev === "NONE" ? "DRAFT" : prev));
        } else {
          setHasDraft(false);
          setStatus("PUBLISHED");
          setLiveMenu(submitted);
        }
        setMessage({
          ok: true,
          text: kind === "save" ? "Đã lưu bản nháp — menu công khai chưa thay đổi." : "Đã xuất bản — menu mới áp dụng cho mọi trang công khai.",
        });
        return;
      }
      setMessage({ ok: false, text: response.error ?? (kind === "save" ? "Lưu nháp thất bại." : "Xuất bản thất bại.") });
      if (response.issues && response.issues.length > 0) {
        setServerIssues(response.issues);
        requestFocus("__summary");
      }
    });
  }

  function restore() {
    const target = status === "PUBLISHED" ? "menu đang hiển thị" : "menu mặc định";
    if (!window.confirm(`Bỏ bản nháp và mọi thay đổi chưa xuất bản, quay về ${target}? Thao tác này không hoàn tác được.`)) return;
    setPendingAction("restore");
    startTransition(async () => {
      const response = await restoreLiveMenuAction();
      if (!response.success) {
        setMessage({ ok: false, text: response.error ?? "Khôi phục thất bại." });
        return;
      }
      setMenu(liveMenu);
      setSavedSnapshot(JSON.stringify(liveMenu));
      setHasDraft(false);
      setAttempted(false);
      setServerIssues([]);
      setFormVersion((v) => v + 1);
      setMessage({ ok: true, text: `Đã khôi phục ${target}.` });
    });
  }

  const busy = (action: PendingAction) => isPending && pendingAction === action;
  const visibleHeader = header.items.filter((item) => item.visible).length;

  return (
    <div className="mt-6 space-y-4" key={formVersion}>
      {status === "NONE" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa lưu lần nào — trang công khai đang dùng menu mặc định.</strong> Lần Lưu nháp hoặc Xuất bản đầu tiên sẽ tạo cấu hình menu.
        </Notice>
      ) : status === "DRAFT" ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <strong>Chưa xuất bản lần nào.</strong> Trang công khai dùng menu mặc định cho tới khi bạn bấm Xuất bản.
        </Notice>
      ) : null}

      {/* Thanh trạng thái + hành động — dính đầu vùng cuộn để luôn thấy nút khi sửa form dài. */}
      <div className="sticky top-0 z-10 -mx-5 border-y bg-white/95 px-5 py-3 backdrop-blur lg:-mx-8 lg:px-8" style={{ borderColor: LINE }}>
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {status === "PUBLISHED" ? (
              <Badge tone="success">Đã xuất bản</Badge>
            ) : status === "DRAFT" ? (
              <Badge tone="neutral">Chưa xuất bản</Badge>
            ) : (
              <Badge tone="neutral">Chưa lưu · menu mặc định</Badge>
            )}
            {hasDraft ? <Badge tone="warning">Có nháp chưa xuất bản</Badge> : null}
            {isDirty ? <Badge tone="info">Có thay đổi chưa lưu</Badge> : null}
            {savedLabel ? (
              <span className="text-xs" style={{ color: INK_SOFT }}>
                Lưu lần cuối: {savedLabel}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" target="_blank" rel="noreferrer" className={BAR_BTN} style={{ borderColor: LINE, color: INK }}>
              <IconExternalLink className="h-4 w-4" /> Xem trang
              <span className="sr-only">(mở tab mới — menu đã xuất bản)</span>
            </Link>
            <GhostButton onClick={restore} disabled={isPending || (!hasDraft && !isDirty)} className={BAR_BTN}>
              {busy("restore") ? "Đang khôi phục..." : "Khôi phục bản đang hiển thị"}
            </GhostButton>
            <GhostButton onClick={() => submit("save")} disabled={isPending} className={BAR_BTN}>
              {busy("save") ? "Đang lưu..." : "Lưu nháp"}
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={() => submit("publish")}
              disabled={isPending}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 ${FOCUS}`}
            >
              <IconCheckCircle className="h-4 w-4" /> {busy("publish") ? "Đang xuất bản..." : "Xuất bản"}
            </PrimaryButton>
          </div>
        </div>
        {message ? (
          <p
            role={message.ok ? "status" : "alert"}
            className="mt-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium"
            style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D" } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: RED }}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="menu-error-summary-title"
          className={`rounded-xl border px-4 py-3 ${FOCUS}`}
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5" }}
        >
          <h2 id="menu-error-summary-title" className="flex items-center gap-2 text-sm font-semibold" style={{ color: RED }}>
            <IconAlertTriangle className="h-4 w-4 shrink-0" /> Chưa lưu được — còn {issues.length} lỗi cần sửa
          </h2>
          <ul className="mt-2 space-y-1">
            {issues.map((issue, index) => {
              const { fieldId, where } = locateIssue(menu, issue.path);
              return (
                <li key={`${issue.path}-${index}`}>
                  {fieldId ? (
                    <button
                      type="button"
                      onClick={() => requestFocus(fieldId)}
                      className={`min-h-11 cursor-pointer rounded text-left text-sm underline underline-offset-2 lg:min-h-0 ${FOCUS}`}
                      style={{ color: RED }}
                    >
                      {where}: {issue.message}
                    </button>
                  ) : (
                    <span className="text-sm" style={{ color: RED }}>
                      {where}: {issue.message}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <span className="font-semibold">Cần xác minh trước khi xuất bản (không chặn lưu):</span>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((rule) => (
              <li key={rule.id}>{rule.message}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <ConfigCard
        icon={<IconMenu className="h-5 w-5" />}
        title="Menu đầu trang"
        badges={<Badge tone="neutral">{`${visibleHeader}/${header.items.length} đang hiện`}</Badge>}
        description={`Desktop (nav ngang) và mobile (nút menu) dùng cùng danh sách. Mục có menu con (1 cấp) trở thành nhóm, bấm để mở.`}
      >
        <SortableListEditor
          id="menu-header-items"
          label="Các mục"
          hint="Nên giữ nhãn cấp 1 ngắn (≤ 20 ký tự) để nav ngang không xuống dòng. “Đăng nhập” và menu tài khoản do hệ thống tự hiện."
          items={header.items}
          onChange={(items) => setHeader({ items })}
          itemLabel={(item, index) => linkName("Mục", item.label, index)}
          max={NAV_HEADER_ITEMS_MAX}
          unit="mục"
          addLabel="Thêm mục"
          create={() => created({ ...emptyLink("nav"), children: [] })}
          focusOnAdd={() => `hdr-${lastCreatedId.current}-label`}
          confirmRemove={(item) => confirmRemoveLink("mục", item.label, item.children.length)}
          emptyText="Chưa có mục nào — header chỉ còn logo, Đăng nhập và nút kêu gọi."
          renderItem={(item, index, update) => (
            <>
              <LinkFields
                idPrefix={`hdr-${item.id}`}
                link={item}
                labelMax={NAV_LABEL_MAX}
                pageOptions={pageOptions}
                groupMode={item.children.length > 0}
                showErrors={attempted}
                onChange={(next) => update({ ...item, ...next })}
              />
              <div className="rounded-xl border-l-4 py-1 pl-3 sm:pl-4" style={{ borderColor: brandColors.surface }}>
                <SortableListEditor
                  id={`menu-children-${item.id}`}
                  label={`Menu con của mục ${index + 1}`}
                  hint={item.children.length === 0 ? "Không bắt buộc. Thêm mục con sẽ biến mục này thành nhóm (bỏ đích riêng)." : undefined}
                  items={item.children}
                  onChange={(children) => update({ ...item, children })}
                  itemLabel={(child, childIndex) => linkName("Mục con", child.label, childIndex)}
                  max={NAV_CHILDREN_MAX}
                  unit="mục con"
                  addLabel="Thêm mục con"
                  create={() => created(emptyLink("sub"))}
                  focusOnAdd={() => `hdr-${lastCreatedId.current}-label`}
                  confirmRemove={(child) => confirmRemoveLink("mục con", child.label)}
                  emptyText="Chưa có mục con — đây là link thường."
                  renderItem={(child, _childIndex, updateChild) => (
                    <LinkFields
                      idPrefix={`hdr-${child.id}`}
                      link={child}
                      labelMax={NAV_LABEL_MAX}
                      pageOptions={pageOptions}
                      showErrors={attempted}
                      onChange={(next) => updateChild({ ...child, ...next })}
                    />
                  )}
                />
              </div>
            </>
          )}
        />
      </ConfigCard>

      <ConfigCard
        icon={<IconRoute className="h-5 w-5" />}
        title="Nút kêu gọi đầu trang"
        badges={header.cta.visible ? <Badge tone="success">Đang hiện</Badge> : <Badge tone="warning">Đang ẩn</Badge>}
        description={`Nút nổi bật cạnh “Đăng nhập”, chỉ hiện cho khách chưa đăng nhập. Nhãn tối đa ${NAV_CTA_LABEL_MAX} ký tự để vừa màn hình điện thoại.`}
      >
        <LinkFields
          idPrefix="cta"
          link={header.cta}
          labelMax={NAV_CTA_LABEL_MAX}
          pageOptions={pageOptions}
          showErrors={attempted}
          onChange={(cta) => setHeader({ cta })}
        />
      </ConfigCard>

      <ConfigCard
        icon={<IconLayers className="h-5 w-5" />}
        title="Chân trang"
        description={`${NAV_FOOTER_COLUMNS_MIN}–${NAV_FOOTER_COLUMNS_MAX} cột, mỗi cột ${NAV_FOOTER_LINKS_MIN}–${NAV_FOOTER_LINKS_MAX} link. Mobile hiện 2 cột (1 cột nếu chỉ có 1), desktop đủ cột cạnh logo.`}
      >
        <div>
          <label htmlFor="footer-description" className="block text-sm font-medium" style={{ color: INK }}>
            Mô tả dưới logo (không bắt buộc)
          </label>
          <textarea
            id="footer-description"
            rows={2}
            maxLength={NAV_FOOTER_DESCRIPTION_MAX}
            value={footer.description}
            aria-describedby="footer-description-hint"
            onChange={(e) => setFooter({ description: e.target.value })}
            className={TEXTAREA}
            style={{ borderColor: LINE }}
          />
          <p id="footer-description-hint" className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
            Để trống = dùng slogan thương hiệu. <span className="tabular-nums">{footer.description.length}/{NAV_FOOTER_DESCRIPTION_MAX}</span> ký tự.
          </p>
        </div>

        <SortableListEditor
          id="menu-footer-columns"
          label="Cột link"
          items={footer.columns}
          onChange={(columns) => setFooter({ columns })}
          itemLabel={(column, index) => linkName("Cột", column.title, index)}
          max={NAV_FOOTER_COLUMNS_MAX}
          min={NAV_FOOTER_COLUMNS_MIN}
          unit="cột"
          addLabel="Thêm cột"
          create={() => created({ id: newId("col"), title: "", links: [emptyLink("foot")] })}
          focusOnAdd={() => `col-${lastCreatedId.current}-title`}
          confirmRemove={(column) => `Xoá cột “${column.title.trim() || "chưa đặt tên"}” cùng ${column.links.length} link?`}
          renderItem={(column, index, updateColumn) => (
            <>
              <TextField
                id={`col-${column.id}-title`}
                label={`Tiêu đề cột (${column.title.length}/${NAV_COLUMN_TITLE_MAX})`}
                value={column.title}
                maxLength={NAV_COLUMN_TITLE_MAX}
                error={attempted && !column.title.trim() ? "Nhập tiêu đề cột." : undefined}
                onChange={(e) => updateColumn({ ...column, title: e.target.value })}
              />
              <SortableListEditor
                id={`menu-links-${column.id}`}
                label={`Link của cột ${index + 1}`}
                items={column.links}
                onChange={(links) => updateColumn({ ...column, links })}
                itemLabel={(link, linkIndex) => linkName("Link", link.label, linkIndex)}
                max={NAV_FOOTER_LINKS_MAX}
                min={NAV_FOOTER_LINKS_MIN}
                unit="link"
                addLabel="Thêm link"
                create={() => created(emptyLink("foot"))}
                focusOnAdd={() => `foot-${lastCreatedId.current}-label`}
                confirmRemove={(link) => confirmRemoveLink("link", link.label)}
                renderItem={(link, _linkIndex, updateLink) => (
                  <LinkFields
                    idPrefix={`foot-${link.id}`}
                    link={link}
                    labelMax={NAV_LABEL_MAX}
                    pageOptions={pageOptions}
                    showErrors={attempted}
                    onChange={(next) => updateLink({ ...link, ...next })}
                  />
                )}
              />
            </>
          )}
        />

        <TextField
          id="footer-copyright"
          label={`Dòng bản quyền (${footer.copyright.length}/${NAV_COPYRIGHT_MAX})`}
          value={footer.copyright}
          maxLength={NAV_COPYRIGHT_MAX}
          hint="Token: {năm} = năm hiện tại (giờ Việt Nam), {brand} = tên nền tảng."
          error={attempted && !footer.copyright.trim() ? "Nhập dòng bản quyền." : undefined}
          onChange={(e) => setFooter({ copyright: e.target.value })}
        />
      </ConfigCard>
    </div>
  );
}
