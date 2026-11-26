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
// `import type` bị xoá khi biên dịch → không kéo code server (Prisma, email…) vào bundle client.
import type { AdminUserStatus } from "../../../../lib/admin-user-detail";
import { lockUserAction, unlockUserAction, type UserLockState } from "../actions";

/**
 * ADR-073 — hộp xác nhận Khoá / Mở khoá tài khoản người dùng (System Admin), dùng ở danh sách `/admin/users` (menu "⋯") và đầu trang
 * chi tiết. Lý do BẮT BUỘC (≤ 500 ký tự — khớp `USER_LOCK_REASON_MAX_LENGTH` ở `lib/admin-users.ts`, không import được vào client) và
 * được GỬI cho người dùng qua email.
 *
 * Cùng mẫu `<dialog>` + `showModal()` với hộp khoá gian hàng (ADR-072): top layer, nền phía sau `inert`, Esc / "Huỷ bỏ" / bấm nền mờ
 * để đóng (đang xử lý thì không đóng), focus vào tiêu đề khi mở, đóng xong trả focus về nơi mở. Thành công → đóng hộp (phản hồi chính
 * là badge trạng thái của trang, kèm câu thông báo cho trình đọc màn hình); riêng khi đổi trạng thái được nhưng email lỗi
 * (`emailSent:false`) hộp ĐỔI sang màn kết quả để quản trị viên đọc cảnh báo trước khi đóng. Chế độ (khoá/mở khoá) chốt lúc mở hộp —
 * action revalidate làm trạng thái đổi giữa chừng cũng không đảo nội dung hộp.
 */

const REASON_MAX_LENGTH = 500;
const REASON_REQUIRED_MESSAGE = `Hãy nhập lý do (tối đa ${REASON_MAX_LENGTH} ký tự).`;
/** Nút xác nhận khoá — đỏ như tông "danger" của kit (chữ trắng trên #DC2626 ≈ 4.8:1). */
const DANGER_BG = "#DC2626";

const initialState: UserLockState = {};

export interface UserLockTarget {
  id: string;
  /** Tên hiển thị: họ tên, hoặc email khi chưa có hồ sơ. */
  name: string;
  email: string;
  status: AdminUserStatus;
  /** Tên gian hàng nếu người dùng là chủ gian hàng — nêu rõ trong hộp khoá (kế hoạch Đợt 4 §9). */
  ownedTenantName?: string | null;
}

type LockMode = "lock" | "unlock";

function modeOf(status: AdminUserStatus): LockMode {
  return status === "LOCKED" ? "unlock" : "lock";
}

export interface UserLockDialogHandle {
  open: () => void;
}

const LOCK_CONSEQUENCES = [
  "Người dùng sẽ không đăng nhập được; mọi thiết bị đang đăng nhập bị đăng xuất ngay.",
  "Nếu là chủ gian hàng: không vào được Studio, nhưng gian hàng vẫn hoạt động bình thường (khách vẫn xem và mua được).",
  "Hồ sơ và dữ liệu được giữ nguyên.",
] as const;

export function UserLockDialog({
  ref,
  user,
  onClosed,
}: {
  ref: Ref<UserLockDialogHandle>;
  user: UserLockTarget;
  onClosed: () => void;
}) {
  const [session, setSession] = useState<{ mode: LockMode; baseline: UserLockState } | null>(null);
  const [open, setOpen] = useState(false);
  const mode: LockMode = session?.mode ?? modeOf(user.status);
  const [state, formAction, isPending] = useActionState(
    (prev: UserLockState, formData: FormData) => (mode === "lock" ? lockUserAction : unlockUserAction)(user.id, prev, formData),
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
      ? `Đã ${verb} tài khoản ${user.name}.${state.emailSent === false ? " Chưa gửi được email cho người dùng." : " Đã gửi email cho người dùng."}`
      : "";

  // Đổi trạng thái được và email đã gửi → đóng hộp. (Email lỗi → giữ hộp mở, hiện màn kết quả.)
  useEffect(() => {
    if (state.success && state.emailSent !== false) dialogRef.current?.close();
  }, [state]);

  // Màn kết quả "email lỗi" thay thế form (nút submit biến mất) → đưa focus về tiêu đề để trình đọc màn hình đọc kết quả.
  useEffect(() => {
    if (emailFailed) titleRef.current?.focus();
  }, [emailFailed]);

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setSession({ mode: modeOf(user.status), baseline: state });
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

  const title = emailFailed ? `Đã ${verb} tài khoản` : isLock ? "Khoá tài khoản?" : "Mở khoá tài khoản?";

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
            Tài khoản <strong className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{user.name}</strong>
            {user.name !== user.email ? <span className="[overflow-wrap:anywhere]"> ({user.email})</span> : null}
            {emailFailed ? ` đã được ${verb}.` : "."}
            {isLock && user.ownedTenantName && !emailFailed ? (
              <>
                {" "}
                Người dùng này là chủ gian hàng <strong className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{user.ownedTenantName}</strong>.
              </>
            ) : null}
          </p>

          {emailFailed ? (
            <>
              <div className="mt-4">
                <Notice tone="warning">
                  <p>
                    Đã {verb} tài khoản <strong className="font-semibold">nhưng chưa gửi được email cho người dùng</strong>. Hãy liên hệ người dùng trực
                    tiếp để báo lý do.
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
                    <p className="font-semibold">Khi khoá tài khoản:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {LOCK_CONSEQUENCES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </Notice>
                ) : (
                  <Notice tone="info">
                    <p>
                      Người dùng đăng nhập lại được. Tài khoản trở về trạng thái <strong className="font-semibold">Đang hoạt động</strong>, hoặc{" "}
                      <strong className="font-semibold">Chờ kích hoạt</strong> nếu người dùng chưa xác minh email.
                    </p>
                  </Notice>
                )}
              </div>

              <label htmlFor={reasonId} className="mt-4 block text-sm font-medium">
                {isLock ? "Lý do khoá" : "Lý do mở khoá"} <span className="font-normal text-gray-600">(bắt buộc)</span>
              </label>
              <p id={hintId} className="mt-1 text-xs leading-relaxed text-gray-600">
                <strong className="font-semibold text-gray-900">Lý do sẽ được gửi cho người dùng qua email</strong> và lưu vào nhật ký quản trị. Chỉ ghi
                nội dung có thể chia sẻ với người dùng; không ghi ghi chú nội bộ.
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
                placeholder={isLock ? "VD: Tài khoản bị báo cáo giả mạo danh tính" : "VD: Đã xác minh lại danh tính người dùng"}
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
                  {isPending ? (isLock ? "Đang khoá..." : "Đang mở khoá...") : isLock ? "Khoá tài khoản" : "Mở khoá tài khoản"}
                </PrimaryButton>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
