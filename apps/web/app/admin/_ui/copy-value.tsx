"use client";

import { useState } from "react";
import { IconCopy } from "./icons";

/**
 * Giá trị chỉ đọc kèm nút "Sao chép" (vd Webhook URL SePay). Phản hồi "Đã chép" đọc qua aria-live; nút ≥44px, có focus ring.
 */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <code className="min-w-0 flex-1 font-mono break-all text-[color:var(--color-primary)]">{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Sao chép ${label}`}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
        style={{ borderColor: "#E5E7EB" }}
      >
        <IconCopy className="h-4 w-4" />
        {copied ? "Đã chép" : "Sao chép"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `Đã sao chép ${label}` : ""}
      </span>
    </div>
  );
}
