"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronDown, IconPlus, IconTrash } from "../../_ui/icons";

/**
 * Danh sách mục có thứ tự dùng chung cho các editor CMS (ADR-041 GĐ2 — thay `ArrayObjectEditor` chưa có đổi thứ tự):
 * Thêm / Lên / Xuống / Xoá. Nút Lên/Xuống thay kéo-thả (WCAG 2.5.7); nút icon 44px dưới `lg`, 36px từ `lg`; đầu/cuối
 * dùng `aria-disabled` (không `disabled`) để focus không rơi mất khi mục chạm đầu/cuối. Mỗi thao tác đọc qua MỘT vùng
 * `role="status"` ẩn, không dời focus; thêm mục → focus ô đầu của mục mới (`focusOnAdd`); xoá → focus về nút Thêm.
 *
 * Danh sách không có id (vd mảng chuỗi) vẫn giữ key ổn định nhờ mảng key nội bộ chạy song song với thao tác — focus ở
 * nút Lên/Xuống đi theo mục vừa di chuyển. Dữ liệu đổi từ bên ngoài (khác độ dài) → sinh lại key.
 */

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const ICON_BTN = `inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-gray-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent lg:h-9 lg:w-9 ${FOCUS}`;
const ADD_BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9 ${FOCUS}`;

let keySeq = 0;
function newKey(): string {
  keySeq += 1;
  return `sle-${keySeq}`;
}

export interface SortableAddOption<T> {
  label: string;
  create: () => T;
  disabled?: boolean;
  /** Vì sao không thêm được (hiện dưới nút khi `disabled`). */
  disabledHint?: string;
}

export interface SortableListEditorProps<T> {
  /** Tiền tố id DOM (nút Thêm = `${id}-add`, lỗi = `${id}-error`). */
  id: string;
  /** Tiêu đề nhóm (legend). */
  label: string;
  /** Gợi ý dưới tiêu đề. */
  hint?: ReactNode;
  items: readonly T[];
  onChange: (items: T[]) => void;
  /** Tên mục để đọc trong nút/thông báo, vd `Câu hỏi 3`. */
  itemLabel: (item: T, index: number) => string;
  renderItem: (item: T, index: number, update: (next: T) => void) => ReactNode;
  /** Một nút "Thêm" (`addLabel` + `create`) hoặc nhiều lựa chọn thêm (`addOptions`). */
  addLabel?: string;
  create?: () => T;
  addOptions?: SortableAddOption<T>[];
  /** Số mục tối đa/tối thiểu (xoá bị chặn khi chạm `min`). */
  max: number;
  min?: number;
  /** Đơn vị trong bộ đếm / thông báo, vd "câu hỏi". */
  unit: string;
  /** Chuỗi xác nhận trước khi xoá (null/undefined = xoá ngay). */
  confirmRemove?: (item: T, index: number) => string | null;
  /** id ô cần focus sau khi thêm mục ở vị trí `index`. */
  focusOnAdd?: (index: number) => string;
  /** Lỗi của cả danh sách (vd trùng, vượt số lượng). */
  error?: string;
  emptyText?: string;
  /** Ẩn nút Lên/Xuống (thứ tự không có nghĩa). */
  sortable?: boolean;
}

export function SortableListEditor<T>({
  id,
  label,
  hint,
  items,
  onChange,
  itemLabel,
  renderItem,
  addLabel,
  create,
  addOptions,
  max,
  min = 0,
  unit,
  confirmRemove,
  focusOnAdd,
  error,
  emptyText,
  sortable = true,
}: SortableListEditorProps<T>) {
  const [keys, setKeys] = useState<string[]>(() => items.map(() => newKey()));
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<{ id: string; seq: number } | null>(null);
  const addRef = useRef<HTMLDivElement>(null);

  // Dữ liệu đổi từ bên ngoài (khôi phục, chuẩn hoá) → độ dài lệch: sinh lại key (render-time adjust, không effect).
  const stableKeys = keys.length === items.length ? keys : items.map((_, i) => keys[i] ?? newKey());
  if (stableKeys !== keys) setKeys(stableKeys);

  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.id === "__add") {
      addRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
      return;
    }
    document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);

  const options: SortableAddOption<T>[] = addOptions ?? (create && addLabel ? [{ label: addLabel, create }] : []);
  const full = items.length >= max;

  function requestFocus(target: string) {
    setFocusTarget((prev) => ({ id: target, seq: (prev?.seq ?? 0) + 1 }));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const nextItems = [...items];
    const nextKeys = [...stableKeys];
    const [item] = nextItems.splice(index, 1);
    const [key] = nextKeys.splice(index, 1);
    nextItems.splice(target, 0, item!);
    nextKeys.splice(target, 0, key!);
    setKeys(nextKeys);
    onChange(nextItems);
    setAnnouncement(`Đã chuyển ${itemLabel(item!, index)} tới vị trí ${target + 1}/${items.length}.`);
  }

  function remove(index: number) {
    const item = items[index];
    if (item === undefined || items.length <= min) return;
    const message = confirmRemove?.(item, index);
    if (message && !window.confirm(message)) return;
    const name = itemLabel(item, index);
    setKeys(stableKeys.filter((_, i) => i !== index));
    onChange(items.filter((_, i) => i !== index));
    setAnnouncement(`Đã xoá ${name}. Còn ${items.length - 1} ${unit}.`);
    requestFocus("__add");
  }

  function add(option: SortableAddOption<T>) {
    if (full || option.disabled) return;
    const item = option.create();
    const index = items.length;
    setKeys([...stableKeys, newKey()]);
    onChange([...items, item]);
    setAnnouncement(`Đã thêm ${itemLabel(item, index)}.`);
    if (focusOnAdd) requestFocus(focusOnAdd(index));
  }

  return (
    <fieldset aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="text-sm font-semibold" style={{ color: INK }}>
        {label}{" "}
        <span className="font-normal tabular-nums" style={{ color: INK_SOFT }}>
          ({items.length}/{max} {unit})
        </span>
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
          {emptyText ?? `Chưa có ${unit} nào.`}
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((item, index) => {
            const name = itemLabel(item, index);
            const first = index === 0;
            const last = index === items.length - 1;
            const cannotRemove = items.length <= min;
            return (
              <li key={stableKeys[index]} className="rounded-xl border bg-white" style={{ borderColor: error ? "#FCA5A5" : LINE }}>
                <div className="flex items-center gap-1 border-b py-1 pr-1 pl-3" style={{ borderColor: LINE }}>
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: INK }}>
                    {name}
                  </p>
                  {sortable ? (
                    <>
                      <button
                        type="button"
                        aria-disabled={first || undefined}
                        onClick={() => (first ? undefined : move(index, -1))}
                        aria-label={`Đưa ${name} lên`}
                        className={ICON_BTN}
                        style={{ color: INK }}
                      >
                        <IconChevronDown className="h-4 w-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        aria-disabled={last || undefined}
                        onClick={() => (last ? undefined : move(index, 1))}
                        aria-label={`Đưa ${name} xuống`}
                        className={ICON_BTN}
                        style={{ color: INK }}
                      >
                        <IconChevronDown className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    aria-disabled={cannotRemove || undefined}
                    onClick={() => (cannotRemove ? undefined : remove(index))}
                    aria-label={`Xoá ${name}`}
                    title={cannotRemove ? `Cần ít nhất ${min} ${unit}` : undefined}
                    className={ICON_BTN}
                    style={{ color: RED }}
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-3 sm:p-4">{renderItem(item, index, (next) => onChange(items.map((it, i) => (i === index ? next : it))))}</div>
              </li>
            );
          })}
        </ol>
      )}

      {options.length > 0 ? (
        <div ref={addRef} className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              id={options.length === 1 ? `${id}-add` : undefined}
              disabled={full || option.disabled}
              onClick={() => add(option)}
              className={ADD_BTN}
              style={{ borderColor: "#9CA3AF", color: INK }}
            >
              <IconPlus className="h-4 w-4" /> {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {full && options.length > 0 ? (
        <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          Đã đủ {max} {unit} — xoá bớt để thêm mới.
        </p>
      ) : (
        options
          .filter((option) => option.disabled && option.disabledHint)
          .map((option) => (
            <p key={option.label} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
              {option.disabledHint}
            </p>
          ))
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}
