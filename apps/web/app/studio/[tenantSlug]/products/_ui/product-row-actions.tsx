"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { productPath } from "@gieochu/core/product-path";
import { brandColors } from "@gieochu/config/theme";
import { MenuItemButton, MenuItemLink, MenuSeparator, RowMenu } from "../../../../admin/_ui/row-menu";
import { IconEdit, IconExternalLink, IconEye, IconEyeOff, IconPackage, IconRoute } from "../../../../admin/_ui/icons";
import {
  archiveProductAction,
  restoreProductAction,
  unpublishProductAction,
  type ProductActionState,
} from "../actions";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type StatusAction = {
  key: "unpublish" | "archive" | "restore";
  label: string;
  pending: string;
  confirm?: string;
  run: (tenantSlug: string, productId: string) => Promise<ProductActionState>;
  icon: React.ReactNode;
};

/**
 * Cột "Thao tác" của 1 dòng sản phẩm: menu "⋯" (mục đầu là "Sửa") (RowMenu dùng chung với System Center).
 * Không có "Xuất bản" (cần kiểm điều kiện + ô cam kết bản quyền ADR-038 — làm trong editor) và không có "Xoá".
 * ADR-038: sản phẩm bị khoá kiểm duyệt không có mục đổi trạng thái (Khôi phục / Chuyển Riêng tư / Lưu trữ) — server
 * vẫn chặn (409 CONTENT_MODERATION_LOCKED, thông điệp hiện dưới menu nếu xảy ra).
 */
export function ProductRowActions({
  tenantSlug,
  productId,
  productSlug,
  title,
  status,
  moderationLocked = false,
}: {
  tenantSlug: string;
  productId: string;
  productSlug: string;
  title: string;
  status: string;
  moderationLocked?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/studio/${tenantSlug}/products/${productId}`;
  const s = status as ProductStatus;

  const statusActions: StatusAction[] = [];
  if (!moderationLocked && s === "PUBLISHED") {
    statusActions.push({
      key: "unpublish",
      label: "Chuyển Riêng tư",
      pending: "Đang chuyển Riêng tư…",
      confirm: `Chuyển "${title}" về Riêng tư? Khách sẽ không còn thấy trang bán của tài liệu này.`,
      run: unpublishProductAction,
      icon: <IconEyeOff />,
    });
  }
  if (s === "ARCHIVED" && !moderationLocked) {
    statusActions.push({
      key: "restore",
      label: "Khôi phục về Riêng tư",
      pending: "Đang khôi phục…",
      run: restoreProductAction,
      icon: <IconEyeOff />,
    });
  }
  if (!moderationLocked && (s === "DRAFT" || s === "PUBLISHED")) {
    statusActions.push({
      key: "archive",
      label: "Lưu trữ",
      pending: "Đang lưu trữ…",
      confirm: `Lưu trữ "${title}"? Tài liệu sẽ bị gỡ khỏi trang bán; bạn có thể khôi phục lại sau.`,
      run: archiveProductAction,
      icon: <IconPackage />,
    });
  }

  function handle(action: StatusAction) {
    if (isPending) return;
    if (action.confirm && !window.confirm(action.confirm)) return;
    setError(null);
    setPendingLabel(action.pending);
    startTransition(async () => {
      try {
        const result = await action.run(tenantSlug, productId);
        if (result.error) {
          setError(result.error);
        } else {
          router.refresh();
        }
      } catch {
        setError("Không thực hiện được. Vui lòng thử lại.");
      } finally {
        setPendingLabel(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center justify-end">
        <RowMenu label={`Thao tác cho ${title}`} size="touch">
          <MenuItemLink href={base} icon={<IconEdit />}>
            Sửa
          </MenuItemLink>
          {s === "PUBLISHED" ? (
            <MenuItemLink href={productPath(tenantSlug, productSlug)} newTab icon={<IconExternalLink />}>
              Xem trang đang bán
            </MenuItemLink>
          ) : null}
          <MenuItemLink href={`${base}/preview`} newTab icon={<IconEye />}>
            Xem trước
          </MenuItemLink>
          <MenuItemLink href={`${base}/share-links`} icon={<IconRoute />}>
            Link chia sẻ
          </MenuItemLink>
          {statusActions.length > 0 ? <MenuSeparator /> : null}
          {statusActions.map((action) => (
            <MenuItemButton key={action.key} type="button" icon={action.icon} disabled={isPending} onClick={() => handle(action)}>
              {action.label}
            </MenuItemButton>
          ))}
        </RowMenu>
      </div>
      <p role="status" aria-live="polite" className="mt-1.5 text-xs empty:mt-0" style={{ color: brandColors.inkSoft }}>
        {isPending && pendingLabel ? pendingLabel : null}
      </p>
      {error ? (
        <p role="alert" className="mt-1.5 max-w-56 text-right text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
