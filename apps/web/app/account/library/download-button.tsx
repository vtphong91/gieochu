"use client";

import { useState } from "react";

/** §"M9": POST /api/downloads issues a single-use token URL; navigating to it triggers the actual (302) download. */
export function DownloadButton({ fileId, disabled, label = "Tải xuống" }: { fileId: string; disabled: boolean; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setError(null);
    setIsPending(true);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Không tải được file.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Không tải được file.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="rounded border px-3 py-1 text-sm text-[var(--color-primary)] disabled:opacity-50"
      >
        {isPending ? "Đang chuẩn bị..." : label}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
