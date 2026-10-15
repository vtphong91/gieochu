"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconChevronDown, IconPin, IconXCircle } from "../../_ui/icons";

export interface PinOption {
  id: string;
  /** Dòng chính (tên tenant / tên tài liệu). */
  label: string;
  /** Dòng phụ (số tài liệu / tên tenant). */
  hint?: string;
  /** false = đang ghim nhưng không còn hiển thị được trên trang chủ. */
  eligible: boolean;
}

/**
 * Chuỗi giao diện của bộ chọn — mặc định là bộ chữ "ghim" của trang chủ (ADR-033). CMS Cửa hàng (ADR-035) truyền
 * bộ chữ riêng, vd bộ chọn danh mục dùng "Chọn / Bỏ chọn". Truyền thiếu key nào thì key đó dùng mặc định.
 */
export interface PinPickerCopy {
  /** Ghi chú dưới tiêu đề. */
  note: string;
  /** Khi chưa chọn mục nào. */
  emptyPinned: string;
  /** Gợi ý dưới ô tìm (khi chưa đủ). */
  searchHint: string;
  /** Động từ nút chọn, vd "Ghim". */
  pinAction: string;
  /** Động từ nút bỏ, vd "Bỏ ghim". */
  unpinAction: string;
  /** Trạng thái đã chọn + tiền tố bộ đếm, vd "Đã ghim". */
  pinnedState: string;
  /** Mục đã chọn nhưng không còn dùng được. */
  unavailable: string;
  /** Mục đã chọn vượt số hiển thị. */
  overLimit: (limit: number) => string;
  /** Đã chọn đủ `max`. */
  full: (max: number) => string;
  /** Tìm không ra kết quả cho từ khoá. */
  noMatch: (query: string) => string;
  /** Không có mục nào để chọn. */
  noOptions: string;
  /** Icon nút chọn / trạng thái đã chọn. */
  PinIcon: ComponentType<{ className?: string }>;
}

const DEFAULT_COPY: PinPickerCopy = {
  note: "Ghim trước, thiếu sẽ tự bù theo đánh giá và mới nhất. Thứ tự ghim là thứ tự hiển thị.",
  emptyPinned: "Chưa ghim mục nào — trang chủ tự chọn theo đánh giá và mới nhất.",
  searchHint: "Gõ để lọc theo tên; chỉ hiện mục đang công khai.",
  pinAction: "Ghim",
  unpinAction: "Bỏ ghim",
  pinnedState: "Đã ghim",
  unavailable: "Không còn hiển thị — sẽ bị bỏ qua, nên bỏ ghim.",
  overLimit: (limit) => `Ngoài số thẻ hiển thị (${limit}) — sẽ không hiện.`,
  full: (max) => `Đã đủ ${max} mục ghim — bỏ bớt để ghim thêm.`,
  noMatch: (query) => `Không có mục công khai nào khớp “${query}”. Thử từ khoá ngắn hơn.`,
  noOptions: "Chưa có mục công khai nào để ghim.",
  PinIcon: IconPin,
};

const INK = brandColors.ink;
const INK_SOFT = "#4B5563";
const LINE = "#E5E7EB";
const SEARCH_DEBOUNCE_MS = 300;

/** Nút icon vuông: 44px dưới lg (target chạm), 36px từ lg. `aria-disabled` thay `disabled` để focus không bị mất khi mục chạm đầu/cuối. */
const ICON_BTN =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-white transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3B82] aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-white lg:h-9 lg:w-9";

const TEXT_BTN =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3B82] disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9 lg:px-3 lg:text-[13px]";

/**
 * ADR-033 — ô chọn ghim cho "Giáo viên & Coach nổi bật" / "Tài liệu nổi bật".
 *
 * - Danh sách đã ghim (thứ tự = thứ tự hiển thị): nút Lên/Xuống (thay kéo-thả, WCAG 2.5.7) + "Bỏ ghim". Mục
 *   `eligible:false` hoặc id không còn trong dữ liệu trả về → nhãn chữ "Không còn hiển thị" (không chỉ dùng màu).
 *   Mục vượt `limit` → nhãn "Ngoài số thẻ hiển thị".
 * - Ô tìm theo tên: gõ là tìm (debounce 300ms, Enter tìm ngay), kết quả cũ bị bỏ nếu có yêu cầu mới hơn.
 * - Thông báo thao tác (đã ghim/bỏ/chuyển vị trí, số kết quả) qua 1 vùng `role="status"` ẩn — không dời focus.
 */
export function PinPicker({
  id,
  label,
  searchLabel,
  searchPlaceholder,
  value,
  max,
  limit,
  initialOptions,
  search,
  onChange,
  copy: copyOverride,
  error,
}: {
  id: string;
  label: string;
  /** Nhãn ô tìm, vd "Tìm giáo viên / coach để ghim". */
  searchLabel: string;
  searchPlaceholder?: string;
  value: string[];
  max: number;
  /** Số thẻ hiển thị của section — mục ghim vượt số này không hiện. */
  limit: number;
  initialOptions: PinOption[];
  search: (query: string, includeIds: string[]) => Promise<PinOption[]>;
  onChange: (ids: string[]) => void;
  /** Bộ chữ riêng (mặc định: "ghim" của trang chủ). */
  copy?: Partial<PinPickerCopy>;
  /** Lỗi kiểm tra của cả danh sách (hiện dưới tiêu đề, gắn `aria-describedby`). */
  error?: string;
}) {
  const copy: PinPickerCopy = { ...DEFAULT_COPY, ...copyOverride };
  const { PinIcon } = copy;
  const [results, setResults] = useState<PinOption[]>(initialOptions);
  const [known, setKnown] = useState<Map<string, PinOption>>(() => new Map(initialOptions.map((o) => [o.id, o])));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const full = value.length >= max;
  const titleId = `${id}-title`;
  const noteId = `${id}-note`;
  const searchId = `${id}-search`;
  const resultsId = `${id}-results`;
  const errorId = `${id}-error`;

  function nameOf(pinnedId: string): string {
    return known.get(pinnedId)?.label ?? "Mục không xác định";
  }

  async function runSearch(text: string) {
    const seq = ++requestSeq.current;
    setLoading(true);
    setFailed(false);
    try {
      const found = await search(text, valueRef.current);
      if (seq !== requestSeq.current) return;
      setResults(found);
      setKnown((prev) => {
        const next = new Map(prev);
        for (const option of found) next.set(option.id, option);
        return next;
      });
      const selectable = found.filter((o) => o.eligible && !valueRef.current.includes(o.id)).length;
      setAnnouncement(selectable === 0 ? `Không có kết quả để ${copy.pinAction.toLowerCase()}.` : `${selectable} kết quả.`);
    } catch {
      if (seq !== requestSeq.current) return;
      setFailed(true);
      setAnnouncement("Không tải được danh sách.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }

  function scheduleSearch(text: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSearch(text), SEARCH_DEBOUNCE_MS);
  }

  function searchNow() {
    if (timer.current) clearTimeout(timer.current);
    void runSearch(query);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
    setAnnouncement(`Đã chuyển ${nameOf(item!)} tới vị trí ${target + 1}.`);
  }

  function pin(option: PinOption) {
    if (full || value.includes(option.id)) return;
    setKnown((prev) => new Map(prev).set(option.id, option));
    onChange([...value, option.id]);
    setAnnouncement(`${copy.pinnedState} ${option.label} ở vị trí ${value.length + 1}.`);
  }

  function unpin(pinnedId: string) {
    onChange(value.filter((v) => v !== pinnedId));
    setAnnouncement(`Đã ${copy.unpinAction.toLowerCase()} ${nameOf(pinnedId)}.`);
  }

  const selectable = results.filter((o) => o.eligible);

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={error ? `${errorId} ${noteId}` : noteId}
      className="rounded-xl border p-4"
      style={{ borderColor: error ? "#DC2626" : LINE }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={titleId} className="text-sm font-semibold" style={{ color: INK }}>
          {label}
        </h3>
        <span className="text-xs font-medium tabular-nums" style={{ color: INK_SOFT }}>
          {copy.pinnedState} {value.length}/{max}
        </span>
      </div>
      <p id={noteId} className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        {copy.note}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}

      {/* ── Đã ghim ── */}
      {value.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-3.5 py-3 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
          {copy.emptyPinned}
        </p>
      ) : (
        <ol className="mt-3 space-y-2" aria-label={`${label} — danh sách ${copy.pinnedState.toLowerCase()}`}>
          {value.map((pinnedId, index) => {
            const option = known.get(pinnedId);
            const unavailable = !option || !option.eligible;
            const overLimit = !unavailable && index >= limit;
            const name = option?.label ?? "Mục không xác định";
            const atTop = index === 0;
            const atBottom = index === value.length - 1;
            return (
              <li
                key={pinnedId}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 sm:flex-nowrap"
                style={{ borderColor: unavailable ? "#FDE68A" : LINE, background: unavailable ? "#FFFBEB" : "white" }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  style={{ background: brandColors.surface, color: brandColors.primary }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]" style={{ color: INK }}>
                    <span className="sr-only">Vị trí {index + 1}: </span>
                    {name}
                  </p>
                  {option?.hint ? (
                    <p className="text-xs [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                      {option.hint}
                    </p>
                  ) : null}
                  {unavailable ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#92400E" }}>
                      <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" /> {copy.unavailable}
                    </p>
                  ) : overLimit ? (
                    <p className="mt-1 text-xs font-semibold" style={{ color: "#92400E" }}>
                      {copy.overLimit(limit)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className={ICON_BTN}
                    style={{ borderColor: LINE, color: INK }}
                    aria-label={`Đưa ${name} lên`}
                    aria-disabled={atTop || undefined}
                    onClick={() => (atTop ? undefined : move(index, -1))}
                  >
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    style={{ borderColor: LINE, color: INK }}
                    aria-label={`Đưa ${name} xuống`}
                    aria-disabled={atBottom || undefined}
                    onClick={() => (atBottom ? undefined : move(index, 1))}
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={TEXT_BTN}
                    style={{ background: "#FEF2F2", color: "#B91C1C" }}
                    aria-label={`${copy.unpinAction} ${name}`}
                    onClick={() => unpin(pinnedId)}
                  >
                    <IconXCircle className="h-4 w-4" /> {copy.unpinAction}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Tìm để ghim ── */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: LINE }}>
        <label htmlFor={searchId} className="block text-sm font-medium" style={{ color: INK }}>
          {searchLabel}
        </label>
        <div className="mt-1.5">
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-controls={resultsId}
            onChange={(e) => {
              setQuery(e.target.value);
              scheduleSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchNow();
              }
            }}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-white px-3.5 py-2 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
            style={{ borderColor: LINE }}
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          {full ? copy.full(max) : copy.searchHint}
        </p>

        <div role="status" className="sr-only">
          {announcement}
        </div>

        <div id={resultsId} className="mt-2" aria-busy={loading || undefined}>
          {failed ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3 text-sm" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }}>
              <span>Không tải được danh sách.</span>
              <button type="button" onClick={searchNow} className={TEXT_BTN} style={{ background: "white", color: "#B91C1C" }}>
                Thử lại
              </button>
            </div>
          ) : loading && selectable.length === 0 ? (
            <p className="px-1 py-3 text-sm" style={{ color: INK_SOFT }}>
              Đang tìm…
            </p>
          ) : selectable.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3.5 py-3 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
              {query.trim() ? copy.noMatch(query.trim()) : copy.noOptions}
            </p>
          ) : (
            <ul
              className={`max-h-72 divide-y overflow-y-auto rounded-lg border transition-opacity ${loading ? "opacity-60" : ""}`}
              style={{ borderColor: LINE }}
              aria-label="Kết quả tìm"
            >
              {selectable.map((option) => {
                const pinned = value.includes(option.id);
                return (
                  <li key={option.id} className="flex items-center gap-3 px-3 py-2" style={{ borderColor: LINE }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]" style={{ color: INK }}>
                        {option.label}
                      </p>
                      {option.hint ? (
                        <p className="text-xs [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                          {option.hint}
                        </p>
                      ) : null}
                    </div>
                    {pinned ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: "#15803D" }}>
                        <PinIcon className="h-3.5 w-3.5" /> {copy.pinnedState}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={TEXT_BTN}
                        style={{ background: brandColors.surface, color: brandColors.primary }}
                        disabled={full}
                        aria-label={`${copy.pinAction} ${option.label}`}
                        onClick={() => pin(option)}
                      >
                        <PinIcon className="h-4 w-4" /> {copy.pinAction}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
