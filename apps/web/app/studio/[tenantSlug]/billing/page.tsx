import { getPrismaClient, withTenant } from "@gieochu/db";
import type { CheckoutResult } from "@gieochu/payments";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { getSubscriptionOverview } from "../../../../lib/subscription-billing";
import { formatRefundDate, getTenantRefundState, type TenantRefundRequestView } from "../../../../lib/subscription-refund";
import { listBankBins } from "../../../../lib/tenant-payment";
import { SUBSCRIPTION_REFUND_STATUS_LABELS, SUBSCRIPTION_REFUND_WINDOW_DAYS, type SubscriptionRefundStatusValue } from "@gieochu/core/subscription-refund";
import { isUnlimitedPlanLimit } from "@gieochu/core/plan-limits";
import { RefundRequestForm } from "./refund-request-form";
import { getEnabledPlatformProviders } from "../../../../lib/platform-payment";
import { RenewForm } from "./renew-form";
import { BillingPoll } from "./billing-poll";
import { AdminPageHeader, Badge, ConfigCard, DataTable, EmptyState, Notice, Td, Tr } from "../../../admin/_ui/kit";
import { IconCard, IconReceipt } from "../../../admin/_ui/icons";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  GRACE: "Quá hạn (ân hạn)",
  CANCELED: "Đã huỷ gia hạn",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  EXPIRED: "Đã hết hạn",
  VOID: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

const INVOICE_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  PENDING: "warning",
  PAID: "success",
  EXPIRED: "neutral",
  VOID: "danger",
  REFUNDED: "neutral",
};

const UPGRADE_TRIGGER_RATIO = 0.8;

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

/** ADR-041 A4: hạn mức 0 = không được phép; -1 = không giới hạn (không có thanh %). */
function usageRatio(used: number, limit: number): number {
  if (isUnlimitedPlanLimit(limit)) return 0;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, used / limit);
}

function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const unlimited = isUnlimitedPlanLimit(limit);
  const notAllowed = !unlimited && limit <= 0;
  const ratio = usageRatio(used, limit);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>
          {used.toLocaleString("vi-VN")} {unit} / {unlimited ? "không giới hạn" : notAllowed ? "không có trong gói" : `${limit.toLocaleString("vi-VN")} ${unit}`}
        </span>
      </div>
      {!unlimited && !notAllowed ? (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "#F3F4F6" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${ratio * 100}%`, background: ratio >= UPGRADE_TRIGGER_RATIO ? "#D97706" : "#0F3B82" }}
          />
        </div>
      ) : null}
    </div>
  );
}

const REFUND_TONE: Record<SubscriptionRefundStatusValue, "warning" | "success" | "danger"> = {
  REQUESTED: "warning",
  APPROVED_REFUNDED: "success",
  REJECTED: "danger",
};

/** Trạng thái yêu cầu hoàn tiền đã gửi — chữ rõ ràng (không chỉ dựa vào màu huy hiệu). */
function RefundRequestStatus({ request }: { request: TenantRefundRequestView }) {
  const rows: [string, string][] = [
    ["Hoá đơn", request.invoiceCode],
    ["Số tiền hoàn", `${request.amountVnd.toLocaleString("vi-VN")}đ`],
    ["Gửi lúc", formatRefundDate(request.createdAt)],
  ];
  if (request.status === "APPROVED_REFUNDED" && request.refundedAt) rows.push(["Đã hoàn lúc", formatRefundDate(request.refundedAt)]);
  if (request.status === "REJECTED" && request.decidedAt) rows.push(["Xử lý lúc", formatRefundDate(request.decidedAt)]);
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-gray-600">{label}</dt>
            <dd className="font-medium [overflow-wrap:anywhere]" style={{ color: "#12213A" }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {request.status === "REQUESTED" ? (
        <Notice tone="info">Quản trị viên đang xử lý yêu cầu — bạn sẽ nhận email khi có kết quả. Gói hiện tại vẫn dùng bình thường trong lúc chờ.</Notice>
      ) : request.status === "APPROVED_REFUNDED" ? (
        <Notice tone="info">Đã hoàn tiền vào tài khoản bạn khai báo. Gian hàng đã chuyển về gói Miễn phí, dữ liệu được giữ nguyên.</Notice>
      ) : (
        <Notice tone="warning">
          <strong>Yêu cầu bị từ chối.</strong>
          {request.adminNote ? (
            <>
              {" "}
              Lý do: <span className="whitespace-pre-line">{request.adminNote}</span>
            </>
          ) : null}{" "}
          Gói hiện tại không thay đổi. Cần trao đổi thêm, vui lòng liên hệ hỗ trợ.
        </Notice>
      )}
      {request.status === "APPROVED_REFUNDED" && request.adminNote ? (
        <p className="text-sm text-gray-600">
          Ghi chú từ quản trị viên: <span className="whitespace-pre-line">{request.adminNote}</span>
        </p>
      ) : null}
      {request.reason ? (
        <p className="text-sm text-gray-600">
          Lý do bạn đã gửi: <span className="whitespace-pre-line">{request.reason}</span>
        </p>
      ) : null}
    </div>
  );
}

export default async function StudioBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const { tenantSlug } = await params;
  const { plan: planParam } = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/billing`);

  const prisma = getPrismaClient();
  const [{ subscription, invoices }, plans, enabledProviders, publishedCount, refund, banks] = await Promise.all([
    getSubscriptionOverview(tenant.id),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceVnd: "asc" } }),
    getEnabledPlatformProviders(),
    withTenant(tenant.id, (tx) => tx.product.count({ where: { tenantId: tenant.id, status: "PUBLISHED" } })),
    getTenantRefundState(tenant.id),
    listBankBins(),
  ]);

  // C5 (ADR-041): `?plan={planId}` từ /pricing chọn sẵn gói — chỉ nhận gói trả phí đang bật; sai/không có → gói hiện tại.
  const paidPlans = plans.filter((p) => !p.isFree);
  const requestedPlanId = typeof planParam === "string" ? planParam : undefined;
  const initialPlanId = requestedPlanId && paidPlans.some((p) => p.id === requestedPlanId) ? requestedPlanId : subscription.planId;

  const pendingInvoice = invoices.find((invoice) => invoice.status === "PENDING");
  const storageUsedMb = Math.round((tenant.storageUsedBytes / (1024 * 1024)) * 10) / 10;
  const plan = subscription.plan;

  const productRatio = usageRatio(publishedCount, plan.maxProducts);
  const storageRatio = usageRatio(storageUsedMb, plan.storageMb);
  const nearLimit = productRatio >= UPGRADE_TRIGGER_RATIO || storageRatio >= UPGRADE_TRIGGER_RATIO;

  return (
    <div className="px-5 py-8 lg:px-8">
      <BillingPoll active={Boolean(pendingInvoice)} />
      <AdminPageHeader title="Gói dịch vụ" subtitle="Theo dõi hạn mức gói hiện tại, gia hạn hoặc nâng cấp." />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ConfigCard
          icon={<IconCard className="h-5 w-5" />}
          title={plan.name}
          badges={plan.isFree ? <Badge tone="info">Không bao giờ hết hạn</Badge> : <Badge tone={subscription.status === "ACTIVE" ? "success" : "warning"}>{STATUS_LABEL[subscription.status] ?? subscription.status}</Badge>}
        >
          {!plan.isFree ? (
            <>
              <p className="text-sm text-gray-500">Hết hạn kỳ hiện tại: {formatVnDate(subscription.currentPeriodEnd)}</p>
              {subscription.graceEndsAt ? (
                <p className="text-sm" style={{ color: "#DC2626" }}>
                  Hạn ân hạn: {formatVnDate(subscription.graceEndsAt)} — hết hạn mà chưa gia hạn, trang sẽ tự động chuyển về gói Free.
                </p>
              ) : null}
            </>
          ) : null}

          <UsageBar label="Sản phẩm" used={publishedCount} limit={plan.maxProducts} unit="sản phẩm" />
          <UsageBar label="Dung lượng" used={storageUsedMb} limit={plan.storageMb} unit="MB" />

          {nearLimit ? (
            <p className="rounded-lg px-3.5 py-2.5 text-xs" style={{ background: "#FFFBEB", color: "#92400E" }}>
              Bạn sắp chạm giới hạn của gói {plan.name}. Nâng cấp để có thêm sản phẩm/dung lượng.
            </p>
          ) : null}
        </ConfigCard>

        {pendingInvoice ? (
          <ConfigCard icon={<IconReceipt className="h-5 w-5" />} title="Hoá đơn đang chờ thanh toán">
            <p className="text-sm text-gray-500">
              Mã: {pendingInvoice.code} · {pendingInvoice.amountVnd.toLocaleString("vi-VN")}đ · hạn{" "}
              {pendingInvoice.dueAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })}
            </p>
            {(() => {
              const checkout = pendingInvoice.checkoutPayload as CheckoutResult | null;
              if (!checkout) return null;
              if (checkout.kind === "QR") {
                return (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={checkout.qrImageDataUrl} alt="QR thanh toán" className="h-48 w-48" />
                    <p className="mt-2 text-sm">
                      {checkout.bank.accountName} — {checkout.bank.accountNo}
                    </p>
                    <p className="text-sm text-gray-500">Nội dung: {checkout.content}</p>
                  </div>
                );
              }
              return (
                <a href={checkout.url} className="inline-block text-sm font-semibold" style={{ color: "#0F3B82" }}>
                  Mở trang thanh toán
                </a>
              );
            })()}
          </ConfigCard>
        ) : (
          <ConfigCard icon={<IconCard className="h-5 w-5" />} title={plan.isFree ? "Nâng cấp" : "Gia hạn / Nâng cấp"}>
            <RenewForm
              tenantSlug={tenant.slug}
              plans={paidPlans.map((p) => ({ id: p.id, name: p.name, priceVnd: p.priceVnd }))}
              currentPlanId={initialPlanId}
              enabledProviders={enabledProviders}
            />
          </ConfigCard>
        )}
      </div>

      {/* ADR-041 B — hoàn tiền gói. Chỉ hiện khi đã có yêu cầu hoặc đang trong hạn được yêu cầu — quá hạn/không phải lần đầu thì ẩn hẳn. */}
      {refund.request || refund.eligibility.eligible ? (
        <div className="mt-6">
          <ConfigCard
            icon={<IconReceipt className="h-5 w-5" />}
            title="Hoàn tiền gói dịch vụ"
            badges={refund.request ? <Badge tone={REFUND_TONE[refund.request.status]}>{SUBSCRIPTION_REFUND_STATUS_LABELS[refund.request.status]}</Badge> : null}
            description={refund.request ? undefined : `Hoàn 100% lần thanh toán gói đầu tiên nếu bạn gửi yêu cầu trong ${SUBSCRIPTION_REFUND_WINDOW_DAYS} ngày kể từ khi thanh toán.`}
          >
            {!refund.available ? (
              <Notice tone="warning">Chức năng hoàn tiền gói đang được cập nhật — vui lòng quay lại sau.</Notice>
            ) : refund.request ? (
              <RefundRequestStatus request={refund.request} />
            ) : refund.eligibility.eligible ? (
              <RefundRequestForm
                tenantSlug={tenant.slug}
                banks={banks.map((bank) => ({ bin: bank.bin, label: `${bank.shortName} — ${bank.name}` }))}
                amountLabel={`${refund.eligibility.amountVnd.toLocaleString("vi-VN")}đ`}
                deadlineLabel={formatRefundDate(refund.eligibility.deadline)}
              />
            ) : (
              <p className="text-sm text-gray-600">{refund.ineligibleMessage}</p>
            )}
          </ConfigCard>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="font-[family-name:var(--font-heading)] mb-3 font-semibold" style={{ color: "#12213A" }}>
          Lịch sử hoá đơn
        </h2>
        {invoices.length === 0 ? (
          <EmptyState icon={<IconReceipt className="h-6 w-6" />} title="Chưa có hoá đơn nào" />
        ) : (
          <DataTable head={["Mã hoá đơn", "Số tiền", "Trạng thái"]}>
            {invoices.map((invoice) => (
              <Tr key={invoice.id}>
                <Td className="font-mono text-xs">{invoice.code}</Td>
                <Td className="font-medium">{invoice.amountVnd.toLocaleString("vi-VN")}đ</Td>
                <Td>
                  <Badge tone={INVOICE_STATUS_TONE[invoice.status] ?? "neutral"}>{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</Badge>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
