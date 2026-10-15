import { getEffectiveBrand } from "../../../../lib/branding";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { listPendingManualInvoices } from "../../../../lib/subscription-billing";
import { AdminPageHeader, EmptyState } from "../../_ui/kit";
import { IconDoc } from "../../_ui/icons";
import { ConfirmButton } from "./confirm-button";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

export default async function AdminBillingInvoicesPage() {
  await requireAdminAccess("/admin/billing/invoices");
  const brand = await getEffectiveBrand();

  const invoices = await listPendingManualInvoices();

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Hoá đơn QR thủ công chờ đối soát"
        subtitle={`Kiểm tra sao kê ngân hàng của ${brand.name} rồi xác nhận từng hoá đơn khớp nội dung chuyển khoản.`}
      />

      {invoices.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IconDoc className="h-6 w-6" />} title="Không có hoá đơn nào đang chờ" description="Mọi hoá đơn QR thủ công đã được đối soát." />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500" style={{ borderColor: "#E5E7EB" }}>
                <th className="px-4 py-3 font-medium">Trang</th>
                <th className="px-4 py-3 font-medium">Gói</th>
                <th className="px-4 py-3 font-medium">Mã hoá đơn</th>
                <th className="px-4 py-3 font-medium">Số tiền</th>
                <th className="px-4 py-3 font-medium">Hạn</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0" style={{ borderColor: "#E5E7EB" }}>
                  <td className="px-4 py-3">{invoice.tenant.name}</td>
                  <td className="px-4 py-3">{invoice.plan.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{invoice.code}</td>
                  <td className="px-4 py-3 font-semibold">{invoice.amountVnd.toLocaleString("vi-VN")}đ</td>
                  <td className="px-4 py-3 text-gray-500">{invoice.dueAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })}</td>
                  <td className="px-4 py-3">
                    <ConfirmButton invoiceId={invoice.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
