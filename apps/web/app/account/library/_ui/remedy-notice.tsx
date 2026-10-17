"use client";

import { useActionState, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { ENTITLEMENT_REMEDY_ERROR_CODES, REMEDY_REFUND_SLA_DAYS, type EntitlementRemedyStatusValue } from "@gieochu/core/entitlement-remedy";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { IconAlertTriangle, IconCheckCircle, IconReceipt } from "../../../admin/_ui/icons";
import { chooseFinalDownloadAction, requestRefundAction, type RemedyActionState } from "../actions";
import { ConfirmDialog, LIBRARY_BTN } from "./confirm-dialog";

/*
 * ADR-039 — khối thông báo quyền lợi người mua trên 1 mục Thư viện khi tài liệu bị gỡ do vi phạm (remedyStatus ≠ NONE,
 * chưa thu hồi). Client component đặt cố định trong thẻ (key theo entitlement) để giữ nguyên instance khi trạng thái đổi
 * sau Server Action (`revalidatePath`) → chuyển focus tới khối trạng thái mới, hộp thoại xác nhận tự gỡ.
 *
 * Khối theo pattern §7.1 UI-Design-System (tint + viền trái 4px, chữ luôn `ink`, câu mở đầu <strong> nói rõ trạng thái).
 */

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });

const BLOCK = "rounded-xl border border-l-4 p-4 text-sm leading-relaxed";
const TONE = {
  warning: { borderColor: brandColors.accent, background: brandColors.accentSoft },
  info: { borderColor: brandColors.primary, background: brandColors.surface },
  neutral: { borderColor: "#9CA3AF", background: "#F3F4F6" },
} as const;

const initialState: RemedyActionState = {};

export interface RemedyNoticeProps {
  entitlementId: string;
  status: Exclude<EntitlementRemedyStatusValue, "NONE">;
  productTitle: string;
  tenantName: string;
  orderCode: string;
  refundAvailable: boolean;
  remedyChosenAt: Date | null;
  /** Lượt tải còn lại (chỉ dùng cho FINAL_DOWNLOAD). */
  remaining: number;
  /** Số lượt cấp khi chọn tải lần cuối = số tệp khả dụng (lượt đếm chung cho cả tài liệu, mỗi lượt tải một tệp). */
  finalDownloadFileCount: number;
  /** Ngày gian hàng xác nhận hoàn tiền (REFUNDED); null → dùng `remedyChosenAt`. */
  remedyResolvedAt: Date | null;
}

function formatDate(date: Date | null): string | null {
  return date ? dateFormat.format(date) : null;
}

export function RemedyNotice(props: RemedyNoticeProps) {
  const { status } = props;
  const headingRef = useRef<HTMLParagraphElement>(null);
  const previousStatus = useRef(status);

  // Trạng thái vừa đổi (khách vừa chọn) → focus vào câu trạng thái mới để trình đọc màn hình thông báo kết quả.
  useEffect(() => {
    if (previousStatus.current !== status) {
      previousStatus.current = status;
      headingRef.current?.focus();
    }
  }, [status]);

  const chosenOn = formatDate(props.remedyChosenAt);
  const resolvedOn = formatDate(props.remedyResolvedAt);

  if (status === "PENDING_CHOICE") return <PendingChoice {...props} headingRef={headingRef} />;

  if (status === "FINAL_DOWNLOAD") {
    const used = props.remaining <= 0;
    return (
      <div className={BLOCK} style={{ ...TONE.warning, color: brandColors.ink }}>
        <div className="flex items-start gap-2.5">
          <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" />
          <div className="min-w-0">
            <p ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
              {used ? "Bạn đã dùng lượt tải cuối của tài liệu này." : `Tài liệu đã bị gỡ do vi phạm chính sách — bạn còn ${props.remaining} lượt tải cuối.`}
            </p>
            <p className="mt-1">
              {chosenOn ? `Bạn đã chọn tải lần cuối ngày ${chosenOn}. ` : null}
              {used
                ? "Tài liệu không còn tải được nữa."
                : `Bạn có ${props.remaining} lượt tải cuối cho ${props.remaining} tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần. Tài liệu chỉ dùng cho cá nhân, không chia sẻ hay phát tán.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "REFUND_REQUESTED") {
    return (
      <div className={BLOCK} style={{ ...TONE.info, color: brandColors.ink }}>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0" style={{ color: brandColors.primary }}>
            <IconReceipt className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
              Đã yêu cầu hoàn tiền{chosenOn ? ` ngày ${chosenOn}` : ""}.
            </p>
            <p className="mt-1">
              Gian hàng {props.tenantName} được đề nghị hoàn tiền đơn <span className="font-mono font-semibold">{props.orderCode}</span> trong{" "}
              {REMEDY_REFUND_SLA_DAYS} ngày và sẽ hoàn trực tiếp cho bạn. Tài liệu không còn tải được.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // REFUNDED
  return (
    <div className={BLOCK} style={{ ...TONE.neutral, color: brandColors.ink }}>
      <div className="flex items-start gap-2.5">
        <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#15803D]" />
        <div className="min-w-0">
          <p ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
            Đã hoàn tiền{(resolvedOn ?? chosenOn) ? ` ngày ${resolvedOn ?? chosenOn}` : ""} — đơn <span className="font-mono">{props.orderCode}</span>.
          </p>
          <p className="mt-1">
            {chosenOn && resolvedOn ? `Bạn đã yêu cầu hoàn tiền ngày ${chosenOn}. ` : null}
            Tài liệu không còn tải được.
          </p>
        </div>
      </div>
    </div>
  );
}

function PendingChoice({
  entitlementId,
  productTitle,
  tenantName,
  orderCode,
  refundAvailable,
  finalDownloadFileCount,
  headingRef,
}: RemedyNoticeProps & { headingRef: RefObject<HTMLParagraphElement | null> }) {
  const router = useRouter();
  const uid = useId();
  const finalTriggerRef = useRef<HTMLButtonElement>(null);
  const refundTriggerRef = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<"final" | "refund" | null>(null);

  const [finalState, finalAction, finalPending] = useActionState(chooseFinalDownloadAction.bind(null, entitlementId), initialState);
  const [refundState, refundAction, refundPending] = useActionState(requestRefundAction.bind(null, entitlementId), initialState);

  // Lựa chọn đã ghi trước đó (tab khác) / quyền tải đã đổi → làm mới trang để hiện trạng thái thật.
  const staleCode = ENTITLEMENT_REMEDY_ERROR_CODES.NOT_PENDING;
  useEffect(() => {
    if (finalState.code === staleCode || refundState.code === staleCode || finalState.code === "NOT_FOUND" || refundState.code === "NOT_FOUND") {
      router.refresh();
    }
  }, [finalState, refundState, router, staleCode]);

  const slug = `${uid}-pending`;

  return (
    <section aria-labelledby={slug} className={BLOCK} style={{ ...TONE.warning, color: brandColors.ink }}>
      <div className="flex items-start gap-2.5">
        <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" />
        <div className="min-w-0 flex-1">
          <p ref={headingRef} id={slug} tabIndex={-1} className="font-semibold outline-none">
            Tài liệu này đã bị gỡ do vi phạm chính sách.
          </p>
          <p className="mt-1">
            Tải xuống đang tạm khoá cho tới khi bạn chọn{refundAvailable ? " 1 trong 2 cách dưới đây" : " tải lần cuối"}.{" "}
            <strong className="font-semibold">Sau khi chọn, bạn không đổi được lựa chọn.</strong>
          </p>
        </div>
      </div>

      <div className={`mt-3 grid gap-3 ${refundAvailable ? "sm:grid-cols-2" : ""}`}>
        <div className="flex flex-col rounded-xl border bg-white p-4" style={{ borderColor: brandColors.line }}>
          <h4 className="font-[family-name:var(--font-heading)] font-semibold">Tải lần cuối</h4>
          <p className="mt-1 flex-1" style={{ color: brandColors.inkSoft }}>
            Bạn có {finalDownloadFileCount} lượt tải cuối cho {finalDownloadFileCount} tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần. Chỉ dùng cho cá nhân, không chia sẻ hay phát tán.
          </p>
          <button
            ref={finalTriggerRef}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setDialog("final")}
            className={`${LIBRARY_BTN} mt-3 w-full border bg-white hover:bg-gray-50 sm:w-auto sm:self-start`}
            style={{ color: brandColors.primary, borderColor: brandColors.primary }}
          >
            Chọn tải lần cuối<span className="sr-only">: {productTitle}</span>
          </button>
        </div>

        {refundAvailable ? (
          <div className="flex flex-col rounded-xl border bg-white p-4" style={{ borderColor: brandColors.line }}>
            <h4 className="font-[family-name:var(--font-heading)] font-semibold">Yêu cầu hoàn tiền</h4>
            <p className="mt-1 flex-1" style={{ color: brandColors.inkSoft }}>
              Không tải được tài liệu nữa. Gian hàng {tenantName} xử lý hoàn tiền trong {REMEDY_REFUND_SLA_DAYS} ngày.
            </p>
            <button
              ref={refundTriggerRef}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setDialog("refund")}
              className={`${LIBRARY_BTN} mt-3 w-full border bg-white hover:bg-gray-50 sm:w-auto sm:self-start`}
              style={{ color: brandColors.primary, borderColor: brandColors.primary }}
            >
              Yêu cầu hoàn tiền<span className="sr-only">: {productTitle}</span>
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: brandColors.inkSoft }}>
            Đơn hàng 0đ nên không có lựa chọn hoàn tiền.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "final"}
        onClose={() => setDialog(null)}
        busy={finalPending}
        returnFocusRef={finalTriggerRef}
        title="Chọn tải lần cuối?"
        description={
          <p>
            Với <strong className="font-semibold">“{productTitle}”</strong>, bạn có {finalDownloadFileCount} lượt tải cuối cho {finalDownloadFileCount} tệp — mỗi lượt tải một tệp, hãy tải mỗi tệp một lần.
          </p>
        }
        error={finalState.error}
        confirm={
          <form action={finalAction}>
            <button type="submit" disabled={finalPending} className={`${LIBRARY_BTN} w-full text-white hover:brightness-110 sm:w-auto`} style={{ background: brandColors.primary }}>
              {finalPending ? "Đang ghi nhận..." : "Xác nhận tải lần cuối"}
            </button>
          </form>
        }
      >
        <ul className="list-disc space-y-1 pl-5">
          <li>Tài liệu chỉ dùng cho mục đích cá nhân — không chia sẻ, đăng lại hay phát tán; bạn chịu trách nhiệm nếu phát tán.</li>
          <li>Trước khi tải, bạn sẽ xác nhận thêm một lần nữa.</li>
          {refundAvailable ? <li>Sau khi chọn, bạn không thể chuyển sang yêu cầu hoàn tiền.</li> : null}
        </ul>
      </ConfirmDialog>

      {refundAvailable ? (
        <ConfirmDialog
          open={dialog === "refund"}
          onClose={() => setDialog(null)}
          busy={refundPending}
          returnFocusRef={refundTriggerRef}
          title="Yêu cầu hoàn tiền?"
          description={
            <p>
              Gian hàng {tenantName} sẽ nhận yêu cầu hoàn tiền đơn <span className="font-mono font-semibold">{orderCode}</span> và được đề nghị hoàn
              trực tiếp cho bạn trong {REMEDY_REFUND_SLA_DAYS} ngày.
            </p>
          }
          error={refundState.error}
          confirm={
            <form action={refundAction}>
              <button type="submit" disabled={refundPending} className={`${LIBRARY_BTN} w-full text-white hover:brightness-110 sm:w-auto`} style={{ background: brandColors.primary }}>
                {refundPending ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
              </button>
            </form>
          }
        >
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-semibold">Bạn sẽ không tải được “{productTitle}” nữa</strong>, kể cả khi chưa nhận được tiền.
            </li>
            <li>Sau khi gửi, bạn không thể chuyển sang tải lần cuối.</li>
          </ul>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
