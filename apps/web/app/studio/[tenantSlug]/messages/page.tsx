import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listStorefrontMessages, STOREFRONT_MESSAGES_PAGE_SIZE, type StorefrontInboxFilter } from "../../../../lib/storefront-messages";
import { AdminPageHeader, Badge, EmptyState } from "../../../admin/_ui/kit";
import { IconExternalLink, IconMail } from "../../../admin/_ui/icons";
import { MessageActions } from "./message-actions";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

const INK = "#12213A";
const LINE = "#E5E7EB";
const TAB_ACTIVE = { background: INK, color: "white" };
const TAB_IDLE = { color: "#4B5563", background: "white", boxShadow: `inset 0 0 0 1px ${LINE}` };

export default async function StudioMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/messages`);
  const query = await searchParams;
  const filter: StorefrontInboxFilter = query.tab === "archived" ? "archived" : "inbox";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const { items, total } = await listStorefrontMessages(tenant.id, { filter, page });
  const totalPages = Math.max(1, Math.ceil(total / STOREFRONT_MESSAGES_PAGE_SIZE));
  const base = `/studio/${tenant.slug}/messages`;
  const hrefFor = (p: number) => `${base}?${new URLSearchParams({ ...(filter === "archived" ? { tab: "archived" } : {}), page: String(p) }).toString()}`;

  const tabClass = "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors lg:min-h-9";
  const pagerClass = "inline-flex min-h-11 items-center rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-gray-50 lg:min-h-9";

  return (
    // Wrapper <div>: layout Studio đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Hộp thư"
        subtitle="Lời nhắn khách gửi qua form liên hệ trên trang bán hàng của bạn."
        action={
          <Link
            href={`/studio/${tenant.slug}/storefront`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
            style={{ borderColor: LINE, color: INK }}
          >
            Cài đặt form liên hệ
          </Link>
        }
      />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Lọc tin nhắn">
        <Link href={base} className={tabClass} style={filter === "inbox" ? TAB_ACTIVE : TAB_IDLE} aria-current={filter === "inbox" ? "page" : undefined}>
          <IconMail className="h-4 w-4" /> Hộp thư
          {filter === "inbox" && total > 0 ? <span className="rounded-full bg-white/20 px-2 text-xs tabular-nums">{total}</span> : null}
        </Link>
        <Link
          href={`${base}?tab=archived`}
          className={tabClass}
          style={filter === "archived" ? TAB_ACTIVE : TAB_IDLE}
          aria-current={filter === "archived" ? "page" : undefined}
        >
          Đã lưu trữ
          {filter === "archived" && total > 0 ? <span className="rounded-full bg-white/20 px-2 text-xs tabular-nums">{total}</span> : null}
        </Link>
      </nav>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<IconMail className="h-6 w-6" />}
            title={filter === "archived" ? "Chưa có tin nhắn lưu trữ" : "Chưa có lời nhắn nào"}
            description={
              filter === "archived"
                ? "Tin bạn bấm “Lưu trữ” sẽ được chuyển vào đây."
                : "Khi khách gửi form liên hệ trên trang của bạn, tin nhắn sẽ hiện ở đây và bạn nhận thêm email báo."
            }
            action={
              filter === "inbox" ? (
                <Link
                  href={`/${tenant.slug}#lien-he`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-2 hover:no-underline"
                  style={{ color: INK }}
                >
                  <IconExternalLink className="h-4 w-4" /> Xem form liên hệ trên trang
                  <span className="sr-only">(mở tab mới)</span>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((m) => {
              const isNew = m.status === "NEW";
              return (
                <li key={m.id}>
                  <article
                    className="relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5"
                    style={{ borderColor: isNew ? "#FCD34D" : LINE, background: isNew ? "#FFFDF5" : "white" }}
                    aria-labelledby={`msg-${m.id}-from`}
                  >
                    {isNew ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: "#D97706" }} /> : null}
                    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: isNew ? "#B45309" : "#6B7280" }}
                        >
                          {m.name.trim().slice(0, 1).toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0">
                          <h2 id={`msg-${m.id}-from`} className="flex flex-wrap items-center gap-2 break-words" style={{ color: INK }}>
                            <span className={isNew ? "font-bold" : "font-semibold"}>{m.name}</span>
                            {isNew ? <Badge tone="warning">Mới</Badge> : null}
                          </h2>
                          <a href={`mailto:${m.email}`} className="text-sm break-all text-gray-600 underline-offset-2 hover:underline">
                            {m.email}
                          </a>
                        </div>
                      </div>
                      <p className="text-xs whitespace-nowrap text-gray-500">
                        <time dateTime={m.createdAt.toISOString()}>{formatVnDateTime(m.createdAt)}</time>
                      </p>
                    </header>
                    <p className={`mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap sm:pl-[52px] ${isNew ? "text-gray-900" : "text-gray-700"}`}>{m.message}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 sm:pl-[52px]" style={{ borderColor: LINE }}>
                      <a
                        href={`mailto:${m.email}`}
                        className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                        style={{ background: "#0F3B82" }}
                      >
                        Trả lời qua email
                      </a>
                      <MessageActions tenantSlug={tenant.slug} messageId={m.id} status={m.status} />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center gap-3 text-sm" aria-label="Phân trang">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={pagerClass} style={{ borderColor: LINE, color: INK }}>
              ← Trang trước
            </Link>
          ) : null}
          <span className="text-gray-600">
            Trang {page}/{totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} className={pagerClass} style={{ borderColor: LINE, color: INK }}>
              Trang sau →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
