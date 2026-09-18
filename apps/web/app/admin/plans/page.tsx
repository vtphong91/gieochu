import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { togglePlanActiveAction } from "./actions";
import { CreatePlanForm } from "./create-plan-form";

export default async function AdminPlansPage() {
  await requireAdminAccess("/admin/plans");

  const prisma = getPrismaClient();
  const plans = await prisma.plan.findMany({ orderBy: { priceVnd: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Gói dịch vụ</h1>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2">Mã</th>
            <th className="py-2">Tên</th>
            <th className="py-2">Giá</th>
            <th className="py-2">Chu kỳ</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id} className="border-b">
              <td className="py-2">{plan.code}</td>
              <td className="py-2">{plan.name}</td>
              <td className="py-2">{plan.priceVnd.toLocaleString("vi-VN")}đ</td>
              <td className="py-2">
                {plan.intervalCount} {plan.interval === "MONTH" ? "tháng" : "năm"}
              </td>
              <td className="py-2">{plan.isActive ? "Đang bật" : "Đã tắt"}</td>
              <td className="py-2">
                <form action={togglePlanActiveAction.bind(null, plan.id)}>
                  <button type="submit" className="text-[var(--color-primary)]">
                    {plan.isActive ? "Tắt" : "Bật"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CreatePlanForm />
    </main>
  );
}
