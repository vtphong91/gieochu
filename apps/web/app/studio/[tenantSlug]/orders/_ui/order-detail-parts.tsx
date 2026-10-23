import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { STAT_CARD_CLASS } from "../../../../admin/_ui/stats-chart";
import {
  IconAlertTriangle,
  IconBank,
  IconCheckCircle,
  IconEdit,
  IconFlag,
  IconMail,
  IconNote,
  IconReceipt,
  IconUsers,
  IconWallet,
} from "../../../../admin/_ui/icons";
import { Notice } from "../../../../admin/_ui/kit";
import type { OrderDetailLine, OrderDetailView, OrderTimelineEvent } from "../../../../../lib/order";
import { formatOrderDateTime, formatOrderPrice, formatOrderVnd, orderNoteAuthorText } from "./order-format";

/*
 * ADR-046 mục 2 — khối trình bày trang chi tiết đơn (Server Component thuần, không hook). Mọi giờ theo giờ VN; tiền đầy
 * đủ. Thẻ dùng chung khung `STAT_CARD_CLASS` của app shell. Màu chỉ hỗ trợ — trạng thái luôn có chữ/icon đi kèm.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PRIMARY = brandColors.primary;
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const WRAP_ANY = "min-w-0 [overflow-wrap:anywhere]";

/** Khung thẻ có tiêu đề h2 (thứ tự heading: h1 trang → h2 thẻ). */
export function DetailCard({
  id,
  title,
  icon,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`${STAT_CARD_CLASS} scroll-mt-6 p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
          {icon ? (
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: brandColors.surface, color: PRIMARY }}>
              {icon}
            </span>
          ) : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Danh sách nhãn — giá trị (2 cột từ sm, 1 cột dưới sm). */
export function InfoList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-gray-100 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt style={{ color: INK_SOFT }}>{item.label}</dt>
          <dd className={`font-medium ${WRAP_ANY}`} style={{ color: INK }}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DateTimeValue({ date, empty = "—" }: { date: Date | null; empty?: string }) {
  if (!date) return <span style={{ color: INK_SOFT }}>{empty}</span>;
  return (
    <time dateTime={date.toISOString()} className="tabular-nums">
      {formatOrderDateTime(date)}
    </time>
  );
}

// ───────────────────────── Dòng tài liệu ─────────────────────────

export function OrderItemsTable({
  items,
  productHref,
  subtotalVnd,
  discountVnd,
  totalVnd,
  couponCode,
  renderEntitlement,
}: {
  items: OrderDetailLine[];
  /** Link tài liệu trong Studio theo `productId`. */
  productHref: (productId: string) => string;
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
  couponCode: string | null;
  /** Khối quyền tải/remedy của từng dòng (giữ thành phần hiện có). */
  renderEntitlement?: (itemId: string) => ReactNode;
}) {
  return (
    <div>
      {/* Tiêu đề cột chỉ hiện từ sm; dưới sm mỗi dòng tự gắn nhãn. */}
      <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_8rem] gap-3 border-b pb-2 text-xs font-medium sm:grid" style={{ borderColor: LINE, color: INK_SOFT }} aria-hidden="true">
        <span>Tài liệu</span>
        <span className="text-right">Giá gốc</span>
        <span className="text-right">Giảm giá</span>
        <span className="text-right">Thành tiền</span>
      </div>
      <ul className="divide-y" style={{ borderColor: LINE }}>
        {items.map((item) => {
          const itemDiscount = item.discountVnd;
          const extra = renderEntitlement?.(item.id);
          return (
            <li key={item.id} className="py-3.5" style={{ borderColor: LINE }}>
              <div className="grid gap-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_8rem] sm:items-baseline sm:gap-3">
                <div className={WRAP_ANY}>
                  <Link href={productHref(item.productId)} className={`font-semibold hover:underline ${FOCUS}`} style={{ color: PRIMARY }}>
                    {item.productTitle}
                  </Link>
                </div>
                <p className="flex justify-between gap-3 tabular-nums sm:block sm:text-right" style={{ color: INK }}>
                  <span className="sm:sr-only" style={{ color: INK_SOFT }}>
                    Giá gốc
                  </span>
                  {formatOrderPrice(item.unitPriceVnd)}
                </p>
                <p className="flex justify-between gap-3 tabular-nums sm:block sm:text-right" style={{ color: INK }}>
                  <span className="sm:sr-only" style={{ color: INK_SOFT }}>
                    Giảm giá
                  </span>
                  {itemDiscount > 0 ? (
                    <span className="sm:block">
                      −{formatOrderVnd(itemDiscount)}
                      {item.couponCode ? (
                        <span className="block text-xs font-normal" style={{ color: INK_SOFT }}>
                          mã <span className="font-mono">{item.couponCode}</span>
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </p>
                <p className="flex justify-between gap-3 font-semibold tabular-nums sm:block sm:text-right" style={{ color: INK }}>
                  <span className="font-normal sm:sr-only" style={{ color: INK_SOFT }}>
                    Thành tiền
                  </span>
                  {formatOrderPrice(item.finalPriceVnd)}
                </p>
              </div>
              {extra ? <div className="mt-3">{extra}</div> : null}
            </li>
          );
        })}
      </ul>
      <dl className="ml-auto mt-1 max-w-sm space-y-1.5 border-t pt-3 text-sm tabular-nums" style={{ borderColor: LINE }}>
        <div className="flex justify-between gap-4">
          <dt style={{ color: INK_SOFT }}>Tạm tính</dt>
          <dd style={{ color: INK }}>{formatOrderPrice(subtotalVnd)}</dd>
        </div>
        {discountVnd > 0 ? (
          <div className="flex justify-between gap-4">
            <dt style={{ color: INK_SOFT }}>
              Giảm giá
              {couponCode ? (
                <>
                  {" "}
                  (mã <span className="font-mono font-semibold" style={{ color: INK }}>{couponCode}</span>)
                </>
              ) : null}
            </dt>
            <dd style={{ color: INK }}>−{formatOrderVnd(discountVnd)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold" style={{ borderColor: LINE, color: INK }}>
          <dt>Thành tiền</dt>
          <dd>{formatOrderPrice(totalVnd)}</dd>
        </div>
      </dl>
    </div>
  );
}

// ───────────────────────── Lịch sử khách hàng ─────────────────────────

export function CustomerHistoryCard({ history }: { history: OrderDetailView["customerHistory"] }) {
  const vnInt = new Intl.NumberFormat("vi-VN");
  const rows: { label: string; value: string }[] = [
    { label: "Đơn đã thanh toán", value: vnInt.format(history.orders) },
    { label: "Tổng chi tiêu", value: formatOrderVnd(history.spentVnd) },
    ...(history.refundedVnd > 0 ? [{ label: "Đã hoàn", value: `−${formatOrderVnd(history.refundedVnd)}` }] : []),
    { label: "Giá trị đơn trung bình", value: history.avgOrderVnd === null ? "—" : formatOrderVnd(history.avgOrderVnd) },
  ];
  return (
    <DetailCard title="Lịch sử khách hàng" icon={<IconUsers className="h-4 w-4" />}>
      {history.orders === 0 ? (
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Khách chưa có đơn trả phí nào đã thanh toán tại gian hàng.
        </p>
      ) : (
        <dl className="space-y-2.5 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt style={{ color: INK_SOFT }}>{row.label}</dt>
              <dd className="font-semibold tabular-nums" style={{ color: INK }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        Chỉ tính đơn trả phí (&gt; 0 đ) đã thanh toán tại gian hàng này. Tổng chi tiêu gồm cả đơn đã hoàn tiền sau đó.
      </p>
    </DetailCard>
  );
}

// ───────────────────────── Dòng thời gian ─────────────────────────

type TimelineKind = OrderTimelineEvent["kind"];
type Tone = "default" | "neutral" | "success" | "warning" | "danger";

const TIMELINE_ICON: Record<TimelineKind, (props: { className?: string }) => ReactNode> = {
  created: IconReceipt,
  payment_txn: IconBank,
  paid: IconWallet,
  expired: IconFlag,
  canceled: IconFlag,
  audit: IconEdit,
  remedy_opened: IconAlertTriangle,
  email: IconMail,
  note: IconNote,
};

const TIMELINE_KIND_TONE: Record<TimelineKind, Tone> = {
  created: "default",
  payment_txn: "default",
  paid: "success",
  expired: "warning",
  canceled: "danger",
  audit: "default",
  remedy_opened: "warning",
  email: "default",
  note: "neutral",
};

const TONE_STYLE: Record<Tone, { bg: string; fg: string }> = {
  default: { bg: brandColors.surface, fg: PRIMARY },
  neutral: { bg: "#F3F4F6", fg: "#4B5563" },
  success: { bg: "#F0FDF4", fg: "#15803D" },
  warning: { bg: brandColors.accentSoft, fg: "#92400E" },
  danger: { bg: "#FEF2F2", fg: "#B91C1C" },
};

/**
 * ADR-047 — thẻ "Ghi chú nội bộ" (cột phụ, ngay trên "Lịch sử đơn"). `form` là client form thêm ghi chú; ghi chú đã có
 * hiện trong dòng thời gian (kind `note`). `available = false` (migration chưa áp) → chỉ hiện Notice, không hiện form.
 */
export function OrderNotesCard({ available, count, form }: { available: boolean; count: number; form: ReactNode }) {
  return (
    <DetailCard id="order-notes" title="Ghi chú nội bộ" icon={<IconNote className="h-4 w-4" />}>
      {available ? (
        <>
          {form}
          <p className="mt-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
            {count > 0
              ? `${new Intl.NumberFormat("vi-VN").format(count)} ghi chú — xem trong “Lịch sử đơn” bên dưới.`
              : "Chưa có ghi chú nào. Ghi chú sẽ hiện trong “Lịch sử đơn” bên dưới."}
          </p>
        </>
      ) : (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          Ghi chú nội bộ tạm chưa sẵn sàng. Vui lòng thử lại sau.
        </Notice>
      )}
    </DetailCard>
  );
}

type TimelineNote = OrderDetailView["notes"][number];

/**
 * Dòng thời gian dọc, mới nhất trên cùng (loader trả cũ → mới; đảo ở đây). Icon chỉ trang trí — nhãn nói rõ sự kiện.
 * Sự kiện `note` (ADR-047): nhãn dựng lại từ `notes` (tác giả `name ?? email`, null → "Tài khoản đã xoá"), nội dung giữ
 * xuống dòng (`pre-wrap`, render dạng text — không HTML), nút xoá do `renderNoteDelete` cấp (chỉ khi `canDelete`).
 */
export function OrderTimeline({
  events,
  notes = [],
  renderNoteDelete,
}: {
  events: OrderTimelineEvent[];
  notes?: TimelineNote[];
  renderNoteDelete?: (noteId: string, timeText: string) => ReactNode;
}) {
  const ordered = [...events].reverse();
  const noteById = new Map(notes.map((note) => [note.id, note]));
  return (
    <DetailCard id="order-timeline" title="Lịch sử đơn" icon={<IconCheckCircle className="h-4 w-4" />}>
      {ordered.length === 0 ? (
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Chưa có sự kiện nào.
        </p>
      ) : (
        <ol className="relative" aria-label="Sự kiện của đơn, mới nhất trước">
          {ordered.map((event, i) => {
            const Icon = TIMELINE_ICON[event.kind] ?? IconFlag;
            const tone = TONE_STYLE[TIMELINE_KIND_TONE[event.kind] ?? "default"];
            const last = i === ordered.length - 1;
            const note = event.kind === "note" && event.noteId ? noteById.get(event.noteId) : undefined;
            const timeText = formatOrderDateTime(event.at);
            return (
              <li key={`${event.at.getTime()}-${event.kind}-${event.noteId ?? i}`} className="relative flex gap-3 pb-5 last:pb-0">
                {!last ? <span aria-hidden="true" className="absolute top-9 bottom-0 left-4 w-px -translate-x-1/2 bg-gray-200" /> : null}
                <span aria-hidden="true" className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: tone.bg, color: tone.fg }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 pt-1 text-sm">
                  <p className={`font-semibold ${WRAP_ANY}`} style={{ color: INK }}>
                    {note ? `Ghi chú nội bộ · ${orderNoteAuthorText(note.author)}` : event.label}
                  </p>
                  {event.kind === "note" ? (
                    event.detail ? (
                      <p
                        className={`mt-1 rounded-lg border px-3 py-2 leading-relaxed whitespace-pre-wrap ${WRAP_ANY}`}
                        style={{ borderColor: LINE, background: "#F9FAFB", color: INK }}
                      >
                        {event.detail}
                      </p>
                    ) : null
                  ) : event.detail ? (
                    <p className={`mt-0.5 leading-relaxed ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
                      {event.detail}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs tabular-nums" style={{ color: INK_SOFT }}>
                    <time dateTime={event.at.toISOString()}>{timeText}</time>
                  </p>
                  {note?.canDelete && renderNoteDelete ? renderNoteDelete(note.id, timeText) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DetailCard>
  );
}
