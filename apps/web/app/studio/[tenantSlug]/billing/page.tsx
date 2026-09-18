import { getPrismaClient, withTenant } from "@gieochu/db";
import type { CheckoutResult } from "@gieochu/payments";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { getSubscriptionOverview } from "../../../../lib/subscription-billing";
import { getEnabledPlatformProviders } from "../../../../lib/platform-payment";
import { RenewForm } from "./renew-form";
import { BillingPoll } from "./billing-poll";

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

const UPGRADE_TRIGGER_RATIO = 0.8;

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const unlimited = limit === 0;
  const ratio = unlimited ? 0 : Math.min(1, used / limit);
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>
          {used.toLocaleString("vi-VN")} {unit} / {unlimited ? "không giới hạn" : `${limit.toLocaleString("vi-VN")} ${unit}`}
        </span>
      </div>
      {!unlimited ? (
        <div className="mt-1 h-2 rounded bg-gray-100">
          <div
            className={`h-2 rounded ${ratio >= UPGRADE_TRIGGER_RATIO ? "bg-amber-500" : "bg-[var(--color-primary)]"}`}
            style={{ width: `${ratio * 100}%` }}
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
    <main className="mx-auto max-w-md px-4 py-10">
      <BillingPoll active={Boolean(pendingInvoice)} />
      <h1 className="text-2xl font-bold">Gói dịch vụ</h1>

      <section className="mt-6 rounded border p-4">
        <p className="text-sm font-medium">
          {plan.name} {plan.isFree ? <span className="text-xs font-normal text-gray-500">(không bao giờ hết hạn)</span> : null}
        </p>
        {!plan.isFree ? (
          <>
            <p className="mt-1 text-sm text-gray-500">Trạng thái: {STATUS_LABEL[subscription.status] ?? subscription.status}</p>
            <p className="mt-1 text-sm text-gray-500">Hết hạn kỳ hiện tại: {formatVnDate(subscription.currentPeriodEnd)}</p>
            {subscription.graceEndsAt ? (
              <p className="mt-1 text-sm text-red-600">
                Hạn ân hạn: {formatVnDate(subscription.graceEndsAt)} — hết hạn mà chưa gia hạn, trang sẽ tự động chuyển về gói Free.
              </p>
            ) : null}
          </>
        ) : null}

        <UsageBar label="Sản phẩm" used={publishedCount} limit={plan.maxProducts} unit="sản phẩm" />
        <UsageBar label="Dung lượng" used={storageUsedMb} limit={plan.storageMb} unit="MB" />

        {nearLimit ? (
          <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            Bạn sắp chạm giới hạn của gói {plan.name}. Nâng cấp để có thêm sản phẩm/dung lượng.
          </p>
        ) : null}
      </section>

      {pendingInvoice ? (
        <section className="mt-6 rounded border p-4">
          <h2 className="text-lg font-semibold">Hoá đơn đang chờ thanh toán</h2>
          <p className="mt-1 text-sm text-gray-500">
            Mã: {pendingInvoice.code} · {pendingInvoice.amountVnd.toLocaleString("vi-VN")}đ · hạn{" "}
            {pendingInvoice.dueAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
          </p>
          {(() => {
            const checkout = pendingInvoice.checkoutPayload as CheckoutResult | null;
            if (!checkout) return null;
            if (checkout.kind === "QR") {
              return (
                <div className="mt-3">
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
              <a href={checkout.url} className="mt-3 inline-block text-[var(--color-primary)] underline">
                Mở trang thanh toán
              </a>
            );
          })()}
        </section>
      ) : (
        <section className="mt-6 rounded border p-4">
          <h2 className="text-lg font-semibold">{plan.isFree ? "Nâng cấp" : "Gia hạn / Nâng cấp"}</h2>
          <div className="mt-3">
            <RenewForm
              tenantSlug={tenant.slug}
              plans={plans.filter((p) => !p.isFree).map((p) => ({ id: p.id, name: p.name, priceVnd: p.priceVnd }))}
              currentPlanId={subscription.planId}
              enabledProviders={enabledProviders}
            />
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Lịch sử hoá đơn</h2>
        <ul className="mt-2 divide-y rounded border">
          {invoices.length === 0 ? <li className="p-3 text-sm text-gray-500">Chưa có hoá đơn.</li> : null}
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between p-3 text-sm">
              <span>{invoice.code}</span>
              <span>{invoice.amountVnd.toLocaleString("vi-VN")}đ</span>
              <span>{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
