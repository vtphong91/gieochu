"use client";

import { useState } from "react";

export interface ShareLinkFile {
  id: string;
  fileName: string;
  sizeBytes: number;
}

function navigateToDownloadUrl(url: string): void {
  window.location.href = url;
}

export function ShareLinkDownloadPanel({ token, files, requiresPassword }: { token: string; files: ShareLinkFile[]; requiresPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);

  async function handleDownload(fileId: string) {
    setError(null);
    setPendingFileId(fileId);
    try {
      const response = await fetch(`/api/share-links/${token}/download`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId, password: requiresPassword ? password : undefined }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Không tải được file.");
        return;
      }
      navigateToDownloadUrl(body.url);
    } catch {
      setError("Không tải được file.");
    } finally {
      setPendingFileId(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {requiresPassword ? (
        <div>
          <label className="block text-sm font-medium" htmlFor="password">
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y rounded border">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between p-3 text-sm">
            <span>{file.fileName}</span>
            <button
              type="button"
              onClick={() => handleDownload(file.id)}
              disabled={pendingFileId === file.id || (requiresPassword && !password)}
              className="rounded border px-3 py-1 text-[var(--color-primary)] disabled:opacity-50"
            >
              {pendingFileId === file.id ? "Đang chuẩn bị..." : "Tải xuống"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
