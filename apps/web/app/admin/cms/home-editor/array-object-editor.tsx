"use client";

import { TextField, GhostButton } from "../../_ui/kit";
import { IconPlus, IconTrash } from "../../_ui/icons";

interface FieldSpec {
  key: string;
  label: string;
}

/**
 * Editor dùng chung cho mọi field dạng mảng-object (stats items, benefits,
 * coaches, documents, testimonials...) — mỗi phần tử là 1 card có input theo
 * đúng field khai báo, nút xoá riêng, nút "+ Thêm" ở cuối. Không có kéo-thả
 * sắp xếp thứ tự trong mảng con — chỉ section cấp cao nhất mới cần (đúng
 * ảnh tham khảo, thứ tự item trong 1 section không có mũi tên riêng).
 */
export function ArrayObjectEditor<T extends Record<string, string>>({
  label,
  items,
  fields,
  emptyItem,
  onChange,
}: {
  label: string;
  items: T[];
  fields: FieldSpec[];
  emptyItem: T;
  onChange: (items: T[]) => void;
}) {
  function updateItem(index: number, key: string, value: string) {
    const next = items.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, emptyItem]);
  }

  return (
    <div>
      <label className="block text-sm font-medium" style={{ color: "#12213A" }}>
        {label}
      </label>
      <div className="mt-1.5 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB" }}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {fields.map((f) => (
                <TextField
                  key={f.key}
                  id={`item-${index}-${f.key}`}
                  label={f.label}
                  value={item[f.key] ?? ""}
                  onChange={(e) => updateItem(index, f.key, e.target.value)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: "#DC2626" }}
            >
              <IconTrash className="h-3.5 w-3.5" /> Xoá mục này
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <GhostButton onClick={addItem}>
          <IconPlus className="h-4 w-4" /> Thêm mục
        </GhostButton>
      </div>
    </div>
  );
}
