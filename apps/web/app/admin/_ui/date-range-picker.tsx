"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { DASHBOARD_CUSTOM_MAX_DAYS, DASHBOARD_PRESETS, DASHBOARD_PRESET_LABELS, type DashboardPreset } from "@gieochu/core/dashboard-range";
import { IconAlertTriangle, IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight, IconClose } from "./icons";

/**
 * ADR-043 lần 3 — ô chọn kỳ thống kê kiểu `dd/mm/yyyy - dd/mm/yyyy` + popup (mốc có sẵn bên trái, lịch bên phải).
 *
 * - Không tự tính kỳ: ngày hiển thị/đánh dấu lấy từ `range.displayFrom/displayTo` (server, giờ VN); "hôm nay" là `today`
 *   (`YYYY-MM-DD` giờ VN do server truyền). Lịch chỉ làm phép tính ngày dương lịch thuần (UTC, không múi giờ).
 * - Chọn mốc → điều hướng ngay `?ky=<key>`; chọn khoảng + "Áp dụng" → `?ky=tuy-chon&tu=…&den=…` (giữ `?chi-so=`). Server
 *   vẫn kiểm lại (sai → về mặc định + Notice).
 * - `<dialog>` mở bằng `showModal()` (bẫy focus, Esc đóng, nền `inert`), đóng xong trả focus về ô mở. ≥ md: popover neo
 *   dưới ô; < md: sheet dưới đáy màn hình, 1 tháng. ≥ xl: 2 tháng cạnh nhau.
 * - Lưới lịch theo pattern grid: roving tabindex, mũi tên ±1 ngày/±1 tuần, Home/End đầu/cuối tuần, PageUp/PageDown ±1 tháng
 *   (Shift: ±1 năm), Enter/Space chọn. Ngày tương lai `aria-disabled` + gạch ngang (không chỉ dựa vào màu).
 * - ADR-046 — chế độ `formMode` (form lọc GET của trang Đơn hàng): không tự điều hướng; chọn mốc / "Áp dụng" khoảng → ghi
 *   vào input ẩn `ky`/`tu`/`den` rồi `requestSubmit()` form chứa ô (giữ nguyên các ô lọc khác đang nhập). `allowAll` thêm
 *   mốc "Mọi thời gian" (`activeKey = null`, không gửi `ky`). Kỳ vẫn do server giải (`resolveDashboardRange`).
 */

const MS_DAY = 86_400_000;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
/** Viền focus vẽ vào trong (mục danh sách sát mép): primary trên nền trắng, trắng trên mục đang chọn (nền primary). */
const FOCUS_INSET = "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const FOCUS_INSET_ON_PRIMARY = "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white";
const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PRIMARY = brandColors.primary;
/** Số năm lùi về trước cho phép duyệt lịch (ngoài ra vẫn nhập được qua URL). */
const YEARS_BACK = 10;

const WEEKDAY_FULL = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"] as const;
const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

/* ------------------------------------------------------------------ Phép tính ngày dương lịch (số ngày từ 1970-01-01) */

type Day = number;
/** Chỉ số tháng tuyệt đối = năm × 12 + tháng (0–11). */
type MonthIndex = number;

const pad = (n: number) => String(n).padStart(2, "0");
const dateOf = (d: Day) => new Date(d * MS_DAY);
const dayFromParts = (y: number, m: number, day: number): Day => Math.round(Date.UTC(y, m, day) / MS_DAY);
const parseDay = (iso: string): Day => dayFromParts(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoOf = (d: Day) => dateOf(d).toISOString().slice(0, 10);
function displayOf(d: Day): string {
  const x = dateOf(d);
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
}
/** 0 = Thứ Hai … 6 = Chủ Nhật. */
const weekdayOf = (d: Day) => (dateOf(d).getUTCDay() + 6) % 7;
function monthOf(d: Day): MonthIndex {
  const x = dateOf(d);
  return x.getUTCFullYear() * 12 + x.getUTCMonth();
}
const firstDayOf = (mi: MonthIndex): Day => dayFromParts(Math.floor(mi / 12), mi % 12, 1);
const monthTitle = (mi: MonthIndex) => `Tháng ${(mi % 12) + 1} năm ${Math.floor(mi / 12)}`;
/** Số tuần ISO-8601 (tuần bắt đầu Thứ Hai, tuần 1 chứa Thứ Năm đầu tiên của năm). */
function isoWeek(d: Day): number {
  const thursday = d - weekdayOf(d) + 3;
  const year = dateOf(thursday).getUTCFullYear();
  return Math.floor((thursday - dayFromParts(year, 0, 1)) / 7) + 1;
}
function fullLabel(d: Day): string {
  const x = dateOf(d);
  return `${WEEKDAY_FULL[weekdayOf(d)]}, ${x.getUTCDate()} tháng ${x.getUTCMonth() + 1} năm ${x.getUTCFullYear()}`;
}
/** 6 hàng × 7 ngày, bắt đầu Thứ Hai trước/đúng ngày 1 — chiều cao lịch cố định giữa các tháng. */
function monthWeeks(mi: MonthIndex): Day[][] {
  const first = firstDayOf(mi);
  const start = first - weekdayOf(first);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => start + w * 7 + i));
}

type Layout = "sheet" | "one" | "two";

function detectLayout(): Layout {
  if (typeof window === "undefined") return "two";
  if (window.matchMedia("(min-width: 80rem)").matches) return "two";
  if (window.matchMedia("(min-width: 48rem)").matches) return "one";
  return "sheet";
}

/** ADR-046: mốc "không giới hạn ngày" — chỉ có ở `formMode.allowAll`. */
const ALL_TIME_LABEL = "Mọi thời gian";

const PRESET_LIST = DASHBOARD_PRESETS.filter((k): k is Exclude<DashboardPreset, "tuy-chon"> => k !== "tuy-chon");

export function DashboardDateRangePicker({
  hrefForPreset,
  hrefForCustom,
  activeKey,
  displayFrom,
  displayTo,
  today: todayIso,
  formMode,
}: {
  /**
   * Chế độ điều hướng (không `formMode`): URL của từng mốc / của khoảng tuỳ chọn. Trang gọi tự dựng (vd dashboard Studio
   * dùng `dashboardHref`, giữ `?chi-so=`) — picker không biết route nào. Bỏ qua khi có `formMode`.
   */
  hrefForPreset?: (key: Exclude<DashboardPreset, "tuy-chon">) => string;
  hrefForCustom?: (tu: string, den: string) => string;
  /** `null` = "Mọi thời gian" — chỉ dùng khi `formMode.allowAll`. */
  activeKey: DashboardPreset | null;
  /** `YYYY-MM-DD` giờ VN — ngày đầu / ngày cuối (bao gồm) của kỳ đang xem. */
  displayFrom: string;
  displayTo: string;
  /** `YYYY-MM-DD` giờ VN của hôm nay (server). */
  today: string;
  /** ADR-046: dùng trong form GET thay vì tự điều hướng (xem chú thích đầu file). */
  formMode?: {
    /** Tên ô cho trình đọc màn hình, vd "Ngày tạo đơn". */
    label: string;
    /** Tiêu đề hộp chọn, vd "Chọn khoảng ngày tạo đơn". */
    dialogTitle: string;
    allowAll?: boolean;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const focusGridRef = useRef(false);
  const initialFocusRef = useRef(false);
  const dialogId = useId();
  const titleId = useId();
  const statusId = useId();
  const kyRef = useRef<HTMLInputElement>(null);
  const tuRef = useRef<HTMLInputElement>(null);
  const denRef = useRef<HTMLInputElement>(null);

  const from = parseDay(displayFrom);
  const to = parseDay(displayTo);
  const today = parseDay(todayIso);
  const todayMonth = monthOf(today);
  const minMonth = (Math.floor(todayMonth / 12) - YEARS_BACK) * 12;
  const minDay = firstDayOf(minMonth);

  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("two");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState<{ start: Day; end: Day | null }>({ start: from, end: to });
  const [hoverDay, setHoverDay] = useState<Day | null>(null);
  const [focusDay, setFocusDay] = useState<Day>(to);
  const [viewMonth, setViewMonth] = useState<MonthIndex>(monthOf(to));

  const monthsShown = layout === "two" ? 2 : 1;
  const maxViewMonth = todayMonth - (monthsShown - 1);
  const clampView = useCallback((mi: MonthIndex) => Math.min(Math.max(mi, minMonth), maxViewMonth), [minMonth, maxViewMonth]);
  const visibleMonths = Array.from({ length: monthsShown }, (_, i) => viewMonth + i);
  const isVisible = (d: Day) => monthOf(d) >= viewMonth && monthOf(d) < viewMonth + monthsShown;
  /** Ngày nhận Tab vào lưới: ngày đang focus nếu đang hiện, không thì ngày 1 của tháng đầu. */
  const tabbableDay = isVisible(focusDay) ? focusDay : firstDayOf(viewMonth);

  function openPicker() {
    const l = detectLayout();
    const shown = l === "two" ? 2 : 1;
    setLayout(l);
    setDraft({ start: from, end: to });
    setHoverDay(null);
    setFocusDay(to);
    setViewMonth(Math.max(minMonth, Math.min(monthOf(to) - (shown - 1), todayMonth - (shown - 1))));
    setPos(null);
    setOpen(true);
  }

  // Mở dialog ngay khi nội dung đã render (trước khi đo vị trí popover).
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
    initialFocusRef.current = true;
  }, [open]);

  // Popover (≥ md): neo ngay dưới ô mở, không tràn khỏi màn hình; tính lại khi đổi kích thước cửa sổ.
  useLayoutEffect(() => {
    if (!open || layout === "sheet") return;
    function place() {
      const dialog = dialogRef.current;
      const trigger = triggerRef.current;
      if (!dialog || !trigger) return;
      const r = trigger.getBoundingClientRect();
      const w = dialog.offsetWidth;
      const h = dialog.offsetHeight;
      const left = Math.max(16, Math.min(r.right - w, window.innerWidth - w - 16));
      const below = r.bottom + 8;
      const top = below + h > window.innerHeight - 16 ? Math.max(16, window.innerHeight - h - 16) : below;
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, layout, viewMonth]);

  // Focus đầu (sau khi popover đã định vị, hết `visibility: hidden`): mốc đang chọn, hoặc ô ngày nếu đang ở "Tuỳ chọn".
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || !initialFocusRef.current || (layout !== "sheet" && !pos)) return;
    initialFocusRef.current = false;
    const target =
      activeKey === "tuy-chon"
        ? dialog.querySelector<HTMLElement>('[data-day][tabindex="0"]')
        : dialog.querySelector<HTMLElement>("[data-preset-active]");
    target?.focus();
  }, [open, layout, pos, activeKey]);

  // Đổi bố cục theo độ rộng khi đang mở (xoay máy, kéo cửa sổ).
  useEffect(() => {
    if (!open) return;
    const queries = [window.matchMedia("(min-width: 48rem)"), window.matchMedia("(min-width: 80rem)")];
    const onChange = () => setLayout(detectLayout());
    queries.forEach((q) => q.addEventListener("change", onChange));
    return () => queries.forEach((q) => q.removeEventListener("change", onChange));
  }, [open]);

  // Sau khi di chuyển bằng bàn phím (có thể đã đổi tháng hiển thị) → focus đúng ô ngày.
  useEffect(() => {
    if (!focusGridRef.current) return;
    focusGridRef.current = false;
    gridAreaRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [focusDay, viewMonth]);

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleDialogClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) e.currentTarget.close();
  }

  function navigate(href: string) {
    closeDialog();
    startTransition(() => router.push(href, { scroll: false }));
  }

  /** `formMode`: ghi kỳ vào input ẩn rồi gửi form chứa ô (ô rỗng bị `disabled` để không rơi `?ky=` thừa vào URL). */
  function submitInForm(ky: DashboardPreset | null, tu?: string, den?: string) {
    const fields: [HTMLInputElement | null, string][] = [
      [kyRef.current, ky ?? ""],
      [tuRef.current, ky === "tuy-chon" ? (tu ?? "") : ""],
      [denRef.current, ky === "tuy-chon" ? (den ?? "") : ""],
    ];
    for (const [input, value] of fields) {
      if (!input) continue;
      input.value = value;
      input.disabled = value === "";
    }
    closeDialog();
    triggerRef.current?.form?.requestSubmit();
  }

  function choosePreset(key: DashboardPreset | null) {
    if (formMode) submitInForm(key);
    else if (key && key !== "tuy-chon" && hrefForPreset) navigate(hrefForPreset(key));
  }

  function moveFocus(d: Day) {
    const next = Math.min(Math.max(d, minDay), today);
    const mi = monthOf(next);
    if (mi < viewMonth) setViewMonth(clampView(mi));
    else if (mi >= viewMonth + monthsShown) setViewMonth(clampView(mi - (monthsShown - 1)));
    focusGridRef.current = true;
    setFocusDay(next);
  }

  function shiftMonths(d: Day, delta: number): Day {
    const x = dateOf(d);
    const mi = x.getUTCFullYear() * 12 + x.getUTCMonth() + delta;
    const lastOfTarget = firstDayOf(mi + 1) - 1;
    return Math.min(firstDayOf(mi) + x.getUTCDate() - 1, lastOfTarget);
  }

  function onGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!target.hasAttribute("data-day")) return;
    const d = Number(target.getAttribute("data-day"));
    let next: Day | null = null;
    switch (e.key) {
      case "ArrowLeft":
        next = d - 1;
        break;
      case "ArrowRight":
        next = d + 1;
        break;
      case "ArrowUp":
        next = d - 7;
        break;
      case "ArrowDown":
        next = d + 7;
        break;
      case "Home":
        next = d - weekdayOf(d);
        break;
      case "End":
        next = d + (6 - weekdayOf(d));
        break;
      case "PageUp":
        next = shiftMonths(d, e.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = shiftMonths(d, e.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    e.preventDefault();
    moveFocus(next);
  }

  function pickDay(d: Day) {
    if (d > today) return;
    setFocusDay(d);
    setDraft((cur) => {
      if (cur.end !== null) return { start: d, end: null };
      return d < cur.start ? { start: d, end: cur.start } : { start: cur.start, end: d };
    });
  }

  function changeView(mi: MonthIndex) {
    const v = clampView(mi);
    setViewMonth(v);
    if (!(monthOf(focusDay) >= v && monthOf(focusDay) < v + monthsShown)) setFocusDay(Math.min(firstDayOf(v), today));
  }

  // Khoảng đang hiển thị trên lịch: đã chọn đủ, hoặc xem trước (ngày đầu → ngày đang trỏ/focus).
  const previewEnd = Math.min(hoverDay ?? focusDay, today);
  const rangeLo = draft.end !== null ? draft.start : Math.min(draft.start, previewEnd);
  const rangeHi = draft.end !== null ? draft.end : Math.max(draft.start, previewEnd);
  const isPreview = draft.end === null;
  const spanDays = draft.end === null ? null : draft.end - draft.start + 1;
  const tooLong = spanDays !== null && spanDays > DASHBOARD_CUSTOM_MAX_DAYS;
  const canApply = draft.end !== null && !tooLong;

  function apply() {
    if (draft.end === null || tooLong) return;
    if (activeKey === "tuy-chon" && draft.start === from && draft.end === to) {
      closeDialog();
      return;
    }
    if (formMode) submitInForm("tuy-chon", isoOf(draft.start), isoOf(draft.end));
    else if (hrefForCustom) navigate(hrefForCustom(isoOf(draft.start), isoOf(draft.end)));
  }

  function focusCalendar() {
    gridAreaRef.current?.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus();
  }

  const yearOptions = Array.from({ length: YEARS_BACK + 1 }, (_, i) => Math.floor(todayMonth / 12) - YEARS_BACK + i);
  const viewYear = Math.floor(viewMonth / 12);
  const sheet = layout === "sheet";
  const allTime = activeKey === null;
  const triggerText = allTime ? ALL_TIME_LABEL : `${displayOf(from)} - ${displayOf(to)}`;
  const fieldLabel = formMode?.label ?? "Kỳ thống kê";
  const presetItemClass = (active: boolean) =>
    sheet
      ? `flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-medium ${active ? "font-semibold" : "border-gray-200 hover:bg-gray-50"} ${FOCUS}`
      : `flex min-h-9 w-full cursor-pointer items-center px-4 text-left text-sm ${active ? `font-semibold ${FOCUS_INSET_ON_PRIMARY}` : `hover:bg-gray-100 ${FOCUS_INSET}`}`;
  const presetItemStyle = (active: boolean) => (active ? { background: PRIMARY, color: "#FFFFFF", borderColor: PRIMARY } : { color: INK });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-describedby={statusId}
        onClick={openPicker}
        className={`inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold tabular-nums transition-colors hover:border-gray-400 hover:bg-gray-50 motion-reduce:transition-none [touch-action:manipulation] ${FOCUS}`}
        style={{ color: INK }}
      >
        <span aria-hidden="true" style={{ color: PRIMARY }}>
          <IconCalendar className="h-5 w-5" />
        </span>
        <span className="sr-only">
          {fieldLabel} {allTime ? "" : `${DASHBOARD_PRESET_LABELS[activeKey]}, từ `}
        </span>
        <span className="whitespace-nowrap">{triggerText}</span>
        <IconChevronDown className="h-4 w-4 shrink-0" />
      </button>
      <span id={statusId} role="status" className="text-xs" style={{ color: INK_SOFT }}>
        {isPending ? "Đang tải số liệu…" : ""}
      </span>
      {formMode ? (
        <>
          <input ref={kyRef} type="hidden" name="ky" defaultValue={activeKey ?? ""} disabled={activeKey === null} />
          <input ref={tuRef} type="hidden" name="tu" defaultValue={activeKey === "tuy-chon" ? displayFrom : ""} disabled={activeKey !== "tuy-chon"} />
          <input ref={denRef} type="hidden" name="den" defaultValue={activeKey === "tuy-chon" ? displayTo : ""} disabled={activeKey !== "tuy-chon"} />
        </>
      ) : null}

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        onClose={handleClose}
        onClick={handleDialogClick}
        className={
          sheet
            ? "range-picker range-picker-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-2xl bg-white p-0 shadow-2xl backdrop:bg-[rgba(18,33,58,0.55)]"
            : "range-picker fixed m-0 max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto rounded-2xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-[rgba(18,33,58,0.12)]"
        }
        style={sheet ? undefined : { inset: "auto", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
      >
        {open ? (
          <div className="flex flex-col">
            <div className={`flex items-center justify-between gap-2 border-b border-gray-200 py-1 pr-1 pl-4 ${sheet ? "" : "sr-only"}`}>
              <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: INK }}>
                {formMode?.dialogTitle ?? "Chọn kỳ thống kê"}
              </h2>
              {sheet ? (
                <button
                  type="button"
                  onClick={closeDialog}
                  className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100 ${FOCUS}`}
                  style={{ color: INK }}
                >
                  <IconClose className="h-5 w-5" />
                  <span className="sr-only">Đóng</span>
                </button>
              ) : null}
            </div>

            <div className={sheet ? "flex flex-col" : "flex"}>
              {/* Mốc có sẵn */}
              <nav aria-label="Mốc thời gian" className={sheet ? "border-b border-gray-200 p-4" : "w-40 shrink-0 border-r border-gray-200 py-2"}>
                <ul className={sheet ? "grid grid-cols-3 gap-2" : "space-y-0.5"}>
                  {formMode?.allowAll ? (
                    <li className={sheet ? "col-span-3" : undefined}>
                      <button
                        type="button"
                        onClick={() => choosePreset(null)}
                        aria-current={allTime ? "true" : undefined}
                        data-preset-active={allTime ? "" : undefined}
                        className={presetItemClass(allTime)}
                        style={presetItemStyle(allTime)}
                      >
                        {ALL_TIME_LABEL}
                      </button>
                    </li>
                  ) : null}
                  {PRESET_LIST.map((key) => {
                    const active = key === activeKey;
                    if (formMode) {
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => choosePreset(key)}
                            aria-current={active ? "true" : undefined}
                            data-preset-active={active ? "" : undefined}
                            className={presetItemClass(active)}
                            style={presetItemStyle(active)}
                          >
                            {DASHBOARD_PRESET_LABELS[key]}
                          </button>
                        </li>
                      );
                    }
                    return (
                      <li key={key}>
                        <Link
                          href={hrefForPreset?.(key) ?? "#"}
                          scroll={false}
                          prefetch={false}
                          onNavigate={(e) => {
                            e.preventDefault();
                            choosePreset(key);
                          }}
                          aria-current={active ? "true" : undefined}
                          data-preset-active={active ? "" : undefined}
                          className={
                            sheet
                              ? `flex min-h-11 items-center justify-center rounded-lg border px-2 text-center text-sm font-medium ${active ? "font-semibold" : "border-gray-200 hover:bg-gray-50"} ${FOCUS}`
                              : `flex min-h-9 items-center px-4 text-sm ${active ? `font-semibold ${FOCUS_INSET_ON_PRIMARY}` : `hover:bg-gray-100 ${FOCUS_INSET}`}`
                          }
                          style={active ? { background: PRIMARY, color: "#FFFFFF", borderColor: PRIMARY } : { color: INK }}
                        >
                          {DASHBOARD_PRESET_LABELS[key]}
                        </Link>
                      </li>
                    );
                  })}
                  <li className={sheet ? "col-span-3" : undefined}>
                    <button
                      type="button"
                      onClick={focusCalendar}
                      aria-current={activeKey === "tuy-chon" ? "true" : undefined}
                      data-preset-active={activeKey === "tuy-chon" ? "" : undefined}
                      className={
                        sheet
                          ? `flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-medium ${activeKey === "tuy-chon" ? "font-semibold" : "border-gray-200 hover:bg-gray-50"} ${FOCUS}`
                          : `flex min-h-9 w-full cursor-pointer items-center px-4 text-left text-sm ${activeKey === "tuy-chon" ? `font-semibold ${FOCUS_INSET_ON_PRIMARY}` : `hover:bg-gray-100 ${FOCUS_INSET}`}`
                      }
                      style={activeKey === "tuy-chon" ? { background: PRIMARY, color: "#FFFFFF", borderColor: PRIMARY } : { color: INK }}
                    >
                      {DASHBOARD_PRESET_LABELS["tuy-chon"]}
                      <span className="sr-only">: chọn khoảng ngày trên lịch</span>
                    </button>
                  </li>
                </ul>
              </nav>

              {/* Lịch */}
              <div className="min-w-0 flex-1">
                <div ref={gridAreaRef} onKeyDown={onGridKeyDown} className={`flex gap-6 p-4 ${sheet ? "justify-center" : ""}`} onMouseLeave={() => setHoverDay(null)}>
                  {visibleMonths.map((mi, idx) => {
                    const first = idx === 0;
                    const last = idx === visibleMonths.length - 1;
                    const captionId = `${dialogId}-m${idx}`;
                    return (
                      <div key={mi} className={sheet ? "w-full max-w-sm" : "w-[18.5rem]"}>
                        <div className="mb-2 flex items-center gap-1">
                          {first ? (
                            <button
                              type="button"
                              onClick={() => changeView(viewMonth - 1)}
                              disabled={viewMonth <= minMonth}
                              className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${FOCUS}`}
                              style={{ color: INK }}
                            >
                              <IconChevronLeft className="h-5 w-5" />
                              <span className="sr-only">Tháng trước</span>
                            </button>
                          ) : (
                            <span className="w-11 shrink-0 md:w-9" aria-hidden="true" />
                          )}
                          <h3 id={captionId} className="sr-only">
                            {monthTitle(mi)}
                          </h3>
                          {first ? (
                            <div className="flex min-w-0 flex-1 justify-center gap-1.5">
                              <label className="sr-only" htmlFor={`${dialogId}-month`}>
                                Tháng
                              </label>
                              <select
                                id={`${dialogId}-month`}
                                value={viewMonth % 12}
                                onChange={(e) => changeView(viewYear * 12 + Number(e.target.value))}
                                className={`min-h-11 cursor-pointer rounded-lg border border-gray-300 bg-white px-2 text-sm font-semibold md:min-h-9 ${FOCUS}`}
                                style={{ color: INK }}
                              >
                                {Array.from({ length: 12 }, (_, m) => (
                                  <option key={m} value={m} disabled={viewYear * 12 + m > maxViewMonth}>
                                    Tháng {m + 1}
                                  </option>
                                ))}
                              </select>
                              <label className="sr-only" htmlFor={`${dialogId}-year`}>
                                Năm
                              </label>
                              <select
                                id={`${dialogId}-year`}
                                value={viewYear}
                                onChange={(e) => changeView(Number(e.target.value) * 12 + (viewMonth % 12))}
                                className={`min-h-11 cursor-pointer rounded-lg border border-gray-300 bg-white px-2 text-sm font-semibold tabular-nums md:min-h-9 ${FOCUS}`}
                                style={{ color: INK }}
                              >
                                {yearOptions.map((y) => (
                                  <option key={y} value={y}>
                                    {y}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <p aria-hidden="true" className="flex-1 text-center text-sm font-semibold" style={{ color: INK }}>
                              Tháng {(mi % 12) + 1} {Math.floor(mi / 12)}
                            </p>
                          )}
                          {last ? (
                            <button
                              type="button"
                              onClick={() => changeView(viewMonth + 1)}
                              disabled={viewMonth >= maxViewMonth}
                              className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${FOCUS}`}
                              style={{ color: INK }}
                            >
                              <IconChevronRight className="h-5 w-5" />
                              <span className="sr-only">Tháng sau</span>
                            </button>
                          ) : (
                            <span className="w-11 shrink-0 md:w-9" aria-hidden="true" />
                          )}
                        </div>

                        <table role="grid" aria-labelledby={captionId} className="w-full table-fixed border-collapse text-center text-sm">
                          <thead>
                            <tr className="text-xs" style={{ color: INK_SOFT }}>
                              <th scope="col" abbr="Tuần" className="h-8 w-[11%] font-medium">
                                W
                              </th>
                              {WEEKDAY_SHORT.map((s, i) => (
                                <th key={s} scope="col" abbr={WEEKDAY_FULL[i]} className="h-8 font-semibold">
                                  {s}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {monthWeeks(mi).map((week) => (
                              <tr key={week[0]}>
                                <th scope="row" className="text-[11px] font-normal tabular-nums" style={{ color: INK_SOFT }}>
                                  <span className="sr-only">Tuần </span>
                                  {isoWeek(week[0]!)}
                                </th>
                                {week.map((d) => (
                                  <DayCell
                                    key={d}
                                    day={d}
                                    inMonth={monthOf(d) === mi}
                                    today={today}
                                    lo={rangeLo}
                                    hi={rangeHi}
                                    preview={isPreview}
                                    anchor={draft.start}
                                    tabbable={d === tabbableDay}
                                    onPick={pickDay}
                                    onHover={draft.end === null ? setHoverDay : undefined}
                                    onFocusDay={setFocusDay}
                                  />
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                {/* Chân: tóm tắt + lỗi + nút */}
                {/* `contain: inline-size`: chữ hướng dẫn không làm popover rộng ra — bề rộng do lịch quyết định, chữ tự xuống dòng. */}
                <div
                  className={`flex flex-col gap-3 border-t border-gray-200 p-4 [contain:inline-size] ${layout === "two" ? "sm:flex-row sm:items-end sm:justify-between" : ""}`}
                >
                  <div className="min-w-0 text-sm" style={{ color: INK }}>
                    <p aria-live="polite" className="tabular-nums">
                      {draft.end === null ? (
                        <>
                          Từ <strong>{displayOf(draft.start)}</strong> — chọn ngày kết thúc
                        </>
                      ) : (
                        <>
                          Đã chọn{" "}
                          <strong className="whitespace-nowrap">
                            {displayOf(draft.start)} - {displayOf(draft.end)}
                          </strong>{" "}
                          ({spanDays?.toLocaleString("vi-VN")} ngày)
                        </>
                      )}
                    </p>
                    {tooLong ? (
                      <p id={`${dialogId}-err`} role="alert" className="mt-1 flex items-start gap-1.5 font-medium text-red-700">
                        <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Khoảng đã chọn dài hơn {DASHBOARD_CUSTOM_MAX_DAYS} ngày — hãy chọn lại ngày bắt đầu hoặc kết thúc.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs" style={{ color: INK_SOFT }}>
                        Bấm ngày bắt đầu rồi ngày kết thúc. Tối đa {DASHBOARD_CUSTOM_MAX_DAYS} ngày, không quá hôm nay (giờ Việt Nam).
                      </p>
                    )}
                  </div>
                  <div className={`flex shrink-0 gap-2 ${layout === "two" ? "" : "sm:justify-end"}`}>
                    <button
                      type="button"
                      onClick={closeDialog}
                      className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold hover:bg-gray-50 sm:flex-none md:min-h-10 ${FOCUS}`}
                      style={{ color: INK }}
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      onClick={apply}
                      disabled={!canApply}
                      aria-describedby={tooLong ? `${dialogId}-err` : undefined}
                      className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none md:min-h-10 ${FOCUS}`}
                      style={{ background: PRIMARY }}
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  today,
  lo,
  hi,
  preview,
  anchor,
  tabbable,
  onPick,
  onHover,
  onFocusDay,
}: {
  day: Day;
  inMonth: boolean;
  today: Day;
  lo: Day;
  hi: Day;
  preview: boolean;
  /** Ngày đã bấm đầu tiên khi đang xem trước (chưa chọn ngày kết thúc). */
  anchor: Day;
  tabbable: boolean;
  onPick: (d: Day) => void;
  onHover?: (d: Day) => void;
  onFocusDay: (d: Day) => void;
}) {
  const label = dateOf(day).getUTCDate();
  if (!inMonth) {
    // Ngày thuộc tháng khác: chỉ để giữ lưới tuần, không tương tác (ngày đó có ở tháng của nó).
    return (
      <td className="p-0">
        <span aria-hidden="true" className="flex h-11 items-center justify-center border-y border-transparent text-sm text-gray-300 tabular-nums md:h-8">
          {label}
        </span>
      </td>
    );
  }
  const future = day > today;
  const isStart = day === lo;
  const isEnd = day === hi;
  // Ô đặc (nền primary): hai đầu khoảng đã chọn; khi đang xem trước chỉ ngày đã bấm — đầu kia viền nét đứt.
  const edge = preview ? day === anchor : isStart || isEnd;
  const previewTip = preview && !edge && (isStart || isEnd);
  const inside = day > lo && day < hi;
  const selected = isStart || isEnd || inside;
  const isToday = day === today;

  const state = [
    isStart && isEnd ? "ngày được chọn" : isStart ? "ngày bắt đầu khoảng chọn" : isEnd ? "ngày kết thúc khoảng chọn" : inside ? "trong khoảng chọn" : "",
    isToday ? "hôm nay" : "",
    future ? "chưa tới, không chọn được" : "",
  ]
    .filter(Boolean)
    .join(", ");

  // Dải khoảng chọn: nền surface + viền trên/dưới (nét liền khi đã chọn xong, nét đứt khi đang xem trước) — không chỉ màu.
  const band = selected ? `border-y ${preview ? "border-dashed" : ""}` : "border-y border-transparent";
  const bandRound = `${isStart ? "rounded-l-full" : ""} ${isEnd ? "rounded-r-full" : ""}`;

  return (
    <td role="gridcell" aria-selected={selected} className="p-0">
      <div
        className={`${band} ${bandRound}`}
        style={selected ? { background: brandColors.surface, borderColor: PRIMARY } : undefined}
      >
        <button
          type="button"
          data-day={day}
          tabIndex={tabbable ? 0 : -1}
          aria-label={`${fullLabel(day)}${state ? `, ${state}` : ""}`}
          aria-disabled={future || undefined}
          aria-current={isToday ? "date" : undefined}
          onClick={() => onPick(day)}
          onMouseEnter={onHover && !future ? () => onHover(day) : undefined}
          onFocus={() => onFocusDay(day)}
          className={`relative mx-auto flex h-11 w-full max-w-11 items-center justify-center rounded-full text-sm tabular-nums [touch-action:manipulation] md:h-8 md:max-w-8 ${FOCUS} ${previewTip ? "border-2 border-dashed" : ""} ${
            future ? "cursor-not-allowed text-gray-400 line-through" : `cursor-pointer ${edge ? "font-bold" : "hover:bg-white"}`
          } ${isToday && !edge ? "font-semibold" : ""}`}
          style={edge ? { background: PRIMARY, color: "#FFFFFF" } : future ? undefined : { color: INK, borderColor: previewTip ? PRIMARY : undefined }}
        >
          {label}
          {isToday ? (
            <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: edge ? "#FFFFFF" : brandColors.accent }} />
          ) : null}
        </button>
      </div>
    </td>
  );
}
