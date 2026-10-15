import { getPrismaClient, withTenant } from "@gieochu/db";
import type { CheckoutResult } from "@gieochu/payments";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { getSubscriptionOverview } from "../../../../lib/subscription-billing";
import { getEnabledPlatformProviders } from "../../../../lib/platform-payment";
import { RenewForm } from "./renew-form";
import { BillingPoll } from "./billing-poll";
import { AdminPageHeader, Badge, ConfigCard, DataTable, EmptyState, Td, Tr } from "../../../admin/_ui/kit";
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
};

const INVOICE_STATUS_TONE: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  PENDING: "warning",
  PAID: "success",
  EXPIRED: "neutral",
  VOID: "danger",
};

const UPGRADE_TRIGGER_RATIO = 0.8;

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const unlimited = limit === 0;
  const ratio = unlimited ? 0 : Math.min(1, used / limit);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>
          {used.toLocaleString("vi-VN")} {unit} / {unlimited ? "không giới hạn" : `${limit.toLocaleString("vi-VN")} ${unit}`}
        </span>
      </div>
      {!unlimited ? (
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

export default async function StudioBillingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/billing`);

  const prisma = getPrismaClient();
  const [{ subscription, invoices }, plans, enabledProviders, publishedCount] = await Promise.all([
    getSubscriptionOverview(tenant.id),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceVnd: "asc" } }),
    getEnabledPlatformProviders(),
    withTenant(tenant.id, (tx) => tx.product.count({ where: { tenantId: tenant.id, status: "PUBLISHED" } })),
  ]);

  const pendingInvoice = invoices.find((invoice) => invoice.status === "PENDING");
  const storageUsedMb = Math.round((tenant.storageUsedBytes / (1024 * 1024)) * 10) / 10;
  const plan = subscription.plan;

  const productRatio = plan.maxProducts === 0 ? 0 : publishedCount / plan.maxProducts;
  const storageRatio = plan.storageMb === 0 ? 0 : storageUsedMb / plan.storageMb;
  const nearLimit = productRatio >= UPGRADE_TRIGGER_RATIO || storageRatio >= UPGRADE_TRIGGER_RATIO;

  return (
    <main className="px-5 py-8 lg:px-8">
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
              plans={plans.filter((p) => !p.isFree).map((p) => ({ id: p.id, name: p.name, priceVnd: p.priceVnd }))}
              currentPlanId={subscription.planId}
              enabledProviders={enabledProviders}
            />
          </ConfigCard>
        )}
      </div>

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
    </main>
  );
}
