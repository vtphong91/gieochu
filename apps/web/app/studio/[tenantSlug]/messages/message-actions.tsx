"use client";

import { useState, useTransition } from "react";
import { RowActionButton } from "../../../admin/_ui/kit";
import { deleteMessageAction, updateMessageStatusAction, type MessageStatusOp } from "./actions";

type Status = "NEW" | "READ" | "ARCHIVED";

export function MessageActions({ tenantSlug, messageId, status }: { tenantSlug: string; messageId: string; status: Status }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  const setStatus = (op: MessageStatusOp) => run(() => updateMessageStatusAction(tenantSlug, messageId, op));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "NEW" ? (
        <RowActionButton type="button" tone="primary" disabled={isPending} onClick={() => setStatus("read")}>
          Đánh dấu đã đọc
        </RowActionButton>
      ) : null}
      {status === "READ" ? (
        <RowActionButton type="button" disabled={isPending} onClick={() => setStatus("unread")}>
          Đánh dấu chưa đọc
        </RowActionButton>
      ) : null}
      {status === "ARCHIVED" ? (
        <RowActionButton type="button" disabled={isPending} onClick={() => setStatus("unarchive")}>
          Đưa về hộp thư
        </RowActionButton>
      ) : (
        <RowActionButton type="button" disabled={isPending} onClick={() => setStatus("archive")}>
          Lưu trữ
        </RowActionButton>
      )}
      <RowActionButton
        type="button"
        tone="danger"
        disabled={isPending}
        onClick={() => {
          if (window.confirm("Xoá vĩnh viễn tin nhắn này?")) run(() => deleteMessageAction(tenantSlug, messageId));
        }}
      >
        Xoá
      </RowActionButton>
      {error ? (
        <span role="alert" className="text-xs" style={{ color: "#DC2626" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
