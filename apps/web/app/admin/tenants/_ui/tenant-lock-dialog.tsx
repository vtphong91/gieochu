"use client";

import {
  useActionState,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type Ref,
  type SyntheticEvent,
} from "react";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, Notice, PrimaryButton } from "../../_ui/kit";
import { IconEye, IconLock, IconUnlock } from "../../_ui/icons";
import { MenuItemButton, MenuItemLink, MenuSeparator, RowMenu } from "../../_ui/row-menu";
// `import type` bị xoá khi biên dịch → không kéo code server (Prisma, email…) vào bundle client.
import type { AdminTenantStatus } from "../../../../lib/admin-tenant-detail";
import { LOCK_REASON_MAX_LENGTH as REASON_MAX_LENGTH } from "../../../../lib/lock-reason";
import { lockTenantAction, unlockTenantAction, type TenantLockState } from "../actions";

/**
 * ADR-072 — hộp xác nhận Khoá / Mở khoá gian hàng (System Admin), dùng ở danh sách `/admin/tenants` (menu "⋯") và đầu trang
 * chi tiết. Lý do BẮT BUỘC (≤ 500 ký tự — khớp `TENANT_LOCK_REASON_MAX_LENGTH` ở server) và được GỬI cho chủ gian hàng qua email.
 *
 * Cùng mẫu `<dialog>` + `showModal()` với hộp ADR-066/067: top layer (không làm dãn ô bảng), nền phía sau `inert`, Esc / "Huỷ bỏ" /
 * bấm nền mờ để đóng (đang xử lý thì không đóng), focus vào tiêu đề khi mở, đóng xong trả focus về nút mở. Thành công → đóng hộp
 * (phản hồi chính là badge trạng thái + Notice của trang, kèm câu thông báo cho trình đọc màn hình); riêng khi đổi trạng thái được
 * nhưng email lỗi (`emailSent:false`) hộp ĐỔI sang màn kết quả để quản trị viên đọc cảnh báo trước khi đóng.
 * Chế độ (khoá/mở khoá) chốt lúc mở hộp — action revalidate làm trạng thái gian hàng đổi giữa chừng cũng không đảo nội dung hộp.
 */

const REASON_REQUIRED_MESSAGE = `Hãy nhập lý do (tối đa ${REASON_MAX_LENGTH} ký tự).`;
/** Nút xác nhận khoá — đỏ như tông "danger" của kit (chữ trắng trên #DC2626 ≈ 4.8:1). */
const DANGER_BG = "#DC2626";

const initialState: TenantLockState = {};

export interface TenantLockTarget {
  id: string;
  name: string;
  slug: string;
  status: AdminTenantStatus;
}

type LockMode = "lock" | "unlock";

function modeOf(status: AdminTenantStatus): LockMode {
  return status === "LOCKED" ? "unlock" : "lock";
}

export interface TenantLockDialogHandle {
  open: () => void;
}

const LOCK_CONSEQUENCES = [
  "Trang gian hàng và tài liệu không còn hiển thị công khai; khách không mua được; link chia sẻ ngừng hoạt động.",
  "Chủ gian hàng vẫn đăng nhập được Studio nhưng không thể tạo hay chỉnh sửa tài liệu, bài viết và mã giảm giá.",
  "Khách đã mua vẫn tải được tài liệu trong thư viện của họ.",
  "Gói dịch vụ và hoá đơn gói không thay đổi.",
] as const;

export function TenantLockDialog({
  ref,
  tenant,
  onClosed,
}: {
  ref: Ref<TenantLockDialogHandle>;
  tenant: TenantLockTarget;
  onClosed: () => void;
}) {
  const [session, setSession] = useState<{ mode: LockMode; baseline: TenantLockState } | null>(null);
  const [open, setOpen] = useState(false);
  const mode: LockMode = session?.mode ?? modeOf(tenant.status);
  const [state, formAction, isPending] = useActionState(
    (prev: TenantLockState, formData: FormData) => (mode === "lock" ? lockTenantAction : unlockTenantAction)(tenant.id, prev, formData),
    initialState,
  );
  const [length, setLength] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const reasonId = `${uid}-reason`;
  const hintId = `${uid}-reason-hint`;
  const errorId = `${uid}-reason-error`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  // Chỉ kết quả MỚI hơn mốc lúc mở hộp mới hiện (lỗi/kết quả của lần mở trước không hiện lại).
  const fresh = session !== null && state !== session.baseline;
  const emailFailed = fresh && state.success === true && state.emailSent === false;
  const error = open && fresh && !state.success ? state.error : undefined;
  const reasonError = (open && fresh && !state.success ? state.reasonError : undefined) ?? localError ?? undefined;
  const isLock = mode === "lock";
  const verb = isLock ? "khoá" : "mở khoá";
  const announced =
    fresh && state.success
      ? `Đã ${verb} gian hàng ${tenant.name}.${state.emailSent === false ? " Chưa gửi được email cho chủ gian hàng." : " Đã gửi email cho chủ gian hàng."}`
      : "";

  // Đổi trạng thái được và email đã gửi → đóng hộp. (Email lỗi → giữ hộp mở, hiện màn kết quả.)
  useEffect(() => {
    if (state.success && state.emailSent !== false) dialogRef.current?.close();
  }, [state]);

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setSession({ mode: modeOf(tenant.status), baseline: state });
      setOpen(true);
      setLength(0);
      setLocalError(null);
      formRef.current?.reset();
      dialog.showModal();
      // Focus tiêu đề: trình đọc màn hình đọc tên + mô tả hộp trước; không bật bàn phím ảo trên mobile.
      titleRef.current?.focus();
    },
  }));

  function closeDialog() {
    if (!isPending) dialogRef.current?.close();
  }

  function handleClosed() {
    setOpen(false);
    onClosed();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc khi đang gửi: giữ hộp mở để người dùng thấy kết quả.
    if (isPending) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDialog();
  }

  /** Lý do trống/chỉ khoảng trắng: báo ngay bằng tiếng Việt, không gọi server (server vẫn kiểm lại). */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const value = new FormData(event.currentTarget).get("reason");
    if (typeof value !== "string" || value.trim().length === 0) {
      event.preventDefault();
      setLocalError(REASON_REQUIRED_MESSAGE);
      reasonRef.current?.focus();
    }
  }

  const title = emailFailed ? `Đã ${verb} gian hàng` : isLock ? "Khoá gian hàng?" : "Mở khoá gian hàng?";

  return (
    <>
      {/* Vùng thông báo chỉ dành cho trình đọc màn hình (sr-only — không để lại khối trống nào trong ô bảng/đầu trang). */}
      <span role="status" className="sr-only">
        {announced}
      </span>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={handleClosed}
        onCancel={handleCancel}
        onClick={handleBackdropClick}
        // Không đặt `flex`/`block` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở <div> con.
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        style={{ color: brandColors.ink }}
      >
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="font-[family-name:var(--font-heading)] text-lg leading-snug font-semibold outline-none"
          >
            {title}
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
            Gian hàng <strong className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{tenant.name}</strong>{" "}
            <span className="[overflow-wrap:anywhere]">(/{tenant.slug})</span>
            {emailFailed ? ` đã được ${verb}.` : "."}
          </p>

          {emailFailed ? (
            <>
              <div className="mt-4">
                <Notice tone="warning">
                  <p>
                    Đã {verb} gian hàng <strong className="font-semibold">nhưng chưa gửi được email cho chủ gian hàng</strong>. Hãy liên hệ chủ gian
                    hàng trực tiếp để báo lý do.
                  </p>
                </Notice>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <GhostButton onClick={closeDialog}>Đóng</GhostButton>
              </div>
            </>
          ) : (
            <form ref={formRef} action={formAction} onSubmit={handleSubmit} noValidate>
              <div className="mt-4">
                {isLock ? (
                  <Notice tone="warning">
                    <p className="font-semibold">Khi khoá gian hàng:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {LOCK_CONSEQUENCES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </Notice>
                ) : (
                  <Notice tone="info">
                    <p>
                      Gian hàng trở về trạng thái <strong className="font-semibold">Hoạt động</strong>: trang gian hàng và tài liệu hiển thị công khai trở
                      lại, khách mua được, chủ gian hàng tạo và chỉnh sửa được nội dung.
                    </p>
                  </Notice>
                )}
              </div>

              <label htmlFor={reasonId} className="mt-4 block text-sm font-medium">
                {isLock ? "Lý do khoá" : "Lý do mở khoá"} <span className="font-normal text-gray-600">(bắt buộc)</span>
              </label>
              <p id={hintId} className="mt-1 text-xs leading-relaxed text-gray-600">
                <strong className="font-semibold text-gray-900">Lý do sẽ được gửi cho chủ gian hàng qua email</strong> và lưu vào nhật ký quản trị.
                Chỉ ghi nội dung có thể chia sẻ với chủ gian hàng; không ghi ghi chú nội bộ.
              </p>
              <textarea
                ref={reasonRef}
                id={reasonId}
                name="reason"
                rows={4}
                maxLength={REASON_MAX_LENGTH}
                aria-required="true"
                aria-invalid={reasonError ? true : undefined}
                aria-describedby={reasonError ? `${hintId} ${errorId}` : hintId}
                placeholder={isLock ? "VD: Nhiều báo cáo vi phạm bản quyền chưa được gỡ" : "VD: Chủ gian hàng đã gỡ nội dung vi phạm"}
                onChange={(event) => {
                  setLength(event.target.value.length);
                  if (localError) setLocalError(null);
                }}
                className={`mt-1.5 w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-base outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/15 motion-reduce:transition-none lg:text-sm ${
                  reasonError ? "border-red-600" : "border-gray-300"
                }`}
              />
              <div className="mt-1.5 flex items-start justify-between gap-3">
                <p id={errorId} role="alert" className="text-sm text-red-700 empty:hidden">
                  {reasonError ?? ""}
                </p>
                <p className="ml-auto shrink-0 text-xs text-gray-600 tabular-nums">
                  <span className="sr-only">Đã nhập </span>
                  {length} / {REASON_MAX_LENGTH}
                  <span className="sr-only"> ký tự</span>
                </p>
              </div>

              {error ? (
                <div className="mt-3">
                  <FormBanner ok={false} message={error} />
                </div>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <GhostButton disabled={isPending} onClick={closeDialog}>
                  Huỷ bỏ
                </GhostButton>
                {/* `style` chỉ truyền khi khoá: truyền `undefined` sẽ đè mất nền primary của kit. */}
                <PrimaryButton loading={isPending} {...(isLock ? { style: { background: DANGER_BG } } : {})}>
                  {isPending ? (isLock ? "Đang khoá..." : "Đang mở khoá...") : isLock ? "Khoá gian hàng" : "Mở khoá gian hàng"}
                </PrimaryButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

/** Lớp chung của nút mở hộp ở đầu trang chi tiết (cùng kích cỡ `GhostLinkButton`: 44px dưới lg, gọn từ lg). */
const TRIGGER_BASE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none lg:min-h-0";
const TRIGGER_LOCK = "border-red-300 text-red-700 focus-visible:outline-red-600";
const TRIGGER_UNLOCK = "border-[color:var(--color-primary)] text-[color:var(--color-primary)] focus-visible:outline-[color:var(--color-primary)]";

/** Nút "Khoá gian hàng…" / "Mở khoá gian hàng…" + hộp xác nhận — đầu trang chi tiết gian hàng. */
export function TenantLockButton({ tenant }: { tenant: TenantLockTarget }) {
  const dialogRef = useRef<TenantLockDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const locked = tenant.status === "LOCKED";

  return (
    <div className="flex flex-col">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.open()}
        className={`${TRIGGER_BASE} ${locked ? TRIGGER_UNLOCK : TRIGGER_LOCK}`}
      >
        {locked ? <IconUnlock className="h-4 w-4" /> : <IconLock className="h-4 w-4" />}
        {locked ? "Mở khoá gian hàng…" : "Khoá gian hàng…"}
      </button>
      <TenantLockDialog ref={dialogRef} tenant={tenant} onClosed={() => triggerRef.current?.focus()} />
    </div>
  );
}

/**
 * Menu "⋯" ở cột "Thao tác" của danh sách: "Xem chi tiết" · (đường kẻ) · "Khoá/Mở khoá gian hàng…" (mở hộp). Hộp nằm NGOÀI menu
 * (menu đóng thì mục biến mất); đóng hộp → trả focus về nút "⋯".
 */
export function TenantRowActions({ tenant }: { tenant: TenantLockTarget }) {
  const dialogRef = useRef<TenantLockDialogHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const locked = tenant.status === "LOCKED";

  return (
    <div ref={wrapRef} className="inline-flex">
      <RowMenu label={`Chức năng cho ${tenant.name}`} size="touch">
        <MenuItemLink href={`/admin/tenants/${tenant.id}`} icon={<IconEye />}>
          Xem chi tiết
        </MenuItemLink>
        <MenuSeparator />
        <MenuItemButton
          type="button"
          aria-haspopup="dialog"
          tone={locked ? "success" : "danger"}
          icon={locked ? <IconUnlock /> : <IconLock />}
          onClick={() => dialogRef.current?.open()}
        >
          {locked ? "Mở khoá gian hàng…" : "Khoá gian hàng…"}
        </MenuItemButton>
      </RowMenu>
      <TenantLockDialog
        ref={dialogRef}
        tenant={tenant}
        onClosed={() => wrapRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus()}
      />
    </div>
  );
}
