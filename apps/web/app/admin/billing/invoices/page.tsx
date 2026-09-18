import { requireAdminAccess } from "../../../../lib/page-guards";
import { listPendingManualInvoices } from "../../../../lib/subscription-billing";
import { ConfirmButton } from "./confirm-button";

export default async function AdminBillingInvoicesPage() {
  await requireAdminAccess("/admin/billing/invoices");

  const invoices = await listPendingManualInvoices();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Hoá đơn QR thủ công chờ đối soát</h1>
      <p className="mt-2 text-sm text-gray-500">
        Kiểm tra sao kê ngân hàng của Tani rồi xác nhận từng hoá đơn khớp nội dung chuyển khoản.
      </p>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Trang</th>
            <th className="py-2">Gói</th>
            <th className="py-2">Mã hoá đơn</th>
            <th className="py-2">Số tiền</th>
            <th className="py-2">Hạn</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-gray-500">
                Không có hoá đơn nào đang chờ.
              </td>
            </tr>
          ) : null}
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b">
              <td className="py-2">{invoice.tenant.name}</td>
              <td className="py-2">{invoice.plan.name}</td>
              <td className="py-2">{invoice.code}</td>
              <td className="py-2">{invoice.amountVnd.toLocaleString("vi-VN")}đ</td>
              <td className="py-2">{invoice.dueAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
              <td className="py-2">
                <ConfirmButton invoiceId={invoice.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
