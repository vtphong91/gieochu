"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

/**
 * Form không kiểm soát + `useActionState` (task 1.8b / 1.11, ADR-058 mục 5):
 * 1. React 19 reset ô không kiểm soát sau MỌI lần action chạy xong, kể cả khi action trả lỗi → mất dữ liệu đã gõ.
 *    Hook chụp giá trị các ô `names` lúc `onSubmit` và ghi lại sau khi form reset. Ô bí mật (`secretNames`: mật khẩu,
 *    secret, API key) KHÔNG bao giờ được ghi lại — để trống = giữ giá trị đã lưu, và secret không quay lại DOM.
 * 2. "Có thay đổi chưa lưu" = ô `names` khác `initial` (giá trị đã lưu từ server) hoặc có ô bí mật đang được nhập.
 *
 * `resetKey` đổi (vd form dựng lại theo dữ liệu server sau khi lưu thành công) → coi như sạch, theo `initial` mới.
 * `failed` = kết quả action hiện tại là lỗi — chỉ ghi lại giá trị khi lần lưu vừa rồi THẤT BẠI (form tạo mới lưu thành
 * công vẫn được React làm trống như cũ). `dirtyOf(names)` = trạng thái "có thay đổi" của một nhóm ô (badge từng khối).
 * `keepOnSuccess` — action lưu thành công nhưng KHÔNG làm mới dữ liệu trang (không `revalidatePath`, `initial` giữ giá trị
 * cũ): React reset ô về `defaultValue` cũ → trông như chưa lưu. Bật để ghi lại giá trị vừa gửi cả khi thành công và lấy
 * làm mốc "đã lưu" mới (secret vẫn không ghi lại).
 * Chỉ dùng cho input/select/textarea có `name`; checkbox lưu dạng boolean. Nhóm checkbox cùng `name` (RadioNodeList) lưu
 * dạng chuỗi các `value` đang tích, nối bằng dấu phẩy (value là id cuid2 — không chứa dấu phẩy).
 */
export type FormDraftValues = Record<string, string | boolean>;

function checkedValues(list: RadioNodeList): string {
  return Array.from(list)
    .filter((node): node is HTMLInputElement => node instanceof HTMLInputElement && node.checked)
    .map((node) => node.value)
    .join(",");
}

function readFields(form: HTMLFormElement, names: readonly string[]): FormDraftValues {
  const values: FormDraftValues = {};
  for (const name of names) {
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) values[name] = checkedValues(field);
    else if (field instanceof HTMLInputElement && field.type === "checkbox") values[name] = field.checked;
    else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) values[name] = field.value;
  }
  return values;
}

function writeFields(form: HTMLFormElement, values: FormDraftValues) {
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) {
      const chosen = new Set(String(value).split(","));
      for (const node of Array.from(field)) if (node instanceof HTMLInputElement) node.checked = chosen.has(node.value);
    } else if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = Boolean(value);
    else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = String(value);
  }
}

export function useFormDraft({
  names,
  secretNames = [],
  initial,
  resetKey,
  failed,
  keepOnSuccess = false,
}: {
  /** Ô được theo dõi và ghi lại sau khi lưu lỗi. */
  names: readonly string[];
  /** Ô bí mật — chỉ theo dõi "đang nhập", không ghi lại. */
  secretNames?: readonly string[];
  /** Giá trị đã lưu (khớp `defaultValue`/`defaultChecked` của các ô `names`). */
  initial: FormDraftValues;
  resetKey: string;
  /** Kết quả action hiện tại là lỗi (vd `Boolean(state.error)`). */
  failed: boolean;
  /** Ghi lại giá trị vừa gửi cả khi lưu thành công + lấy làm mốc mới (action không làm mới `initial`). */
  keepOnSuccess?: boolean;
}) {
  const allNames = [...names, ...secretNames];
  const [values, setValues] = useState<FormDraftValues>(initial);
  // Mốc "đã lưu" — mặc định là `initial`; `keepOnSuccess` đổi mốc thành giá trị vừa gửi sau khi lưu thành công.
  const [baseline, setBaseline] = useState<FormDraftValues>(initial);
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setValues(initial);
    setBaseline(initial);
  }
  // Bản chụp lúc gửi — chỉ ghi/đọc trong event handler.
  const snapshotRef = useRef<FormDraftValues | null>(null);
  // Kết quả mới nhất cho trình xử lý `reset` (chạy trong setTimeout, sau commit) — cập nhật trong layout effect.
  const failedRef = useRef(failed);
  useLayoutEffect(() => {
    failedRef.current = failed;
  }, [failed]);

  const changed = (name: string) =>
    secretNames.includes(name) ? typeof values[name] === "string" && values[name] !== "" : values[name] !== undefined && values[name] !== baseline[name];
  const dirtyOf = (group: readonly string[]) => group.some(changed);
  const dirty = dirtyOf(allNames);

  const formProps = {
    onChange: (event: ChangeEvent<HTMLFormElement>) => setValues(readFields(event.currentTarget, allNames)),
    onSubmit: (event: FormEvent<HTMLFormElement>) => {
      snapshotRef.current = readFields(event.currentTarget, names);
    },
    onReset: (event: FormEvent<HTMLFormElement>) => {
      const form = event.currentTarget;
      const snapshot = snapshotRef.current;
      snapshotRef.current = null;
      // `reset` chạy TRƯỚC khi trình duyệt khôi phục giá trị → ghi lại/đọc ở tick sau. Form đã bị dựng lại (lưu thành
      // công, đổi key) thì bỏ qua — form mới đã mang dữ liệu server.
      window.setTimeout(() => {
        if (!form.isConnected) return;
        if (snapshot && failedRef.current) writeFields(form, snapshot);
        else if (snapshot && keepOnSuccess) {
          writeFields(form, snapshot);
          setBaseline(snapshot);
        }
        setValues(readFields(form, allNames));
      }, 0);
    },
  };

  /** `values`: giá trị hiện tại của các ô được theo dõi (đọc sau mỗi lần đổi) — dùng cho badge tóm tắt khi khối thu gọn. */
  return { dirty, dirtyOf, values, formProps };
}
