import { afterAll, describe, expect, it } from "vitest";
import { generateOrderCode, resolveDashboardRange } from "@gieochu/core";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { ANONYMOUS_CUSTOMER_LABEL, getTenantDashboard } from "../../lib/tenant-dashboard";
import type { CurrentUser } from "../../lib/session";

// ADR-043 — 1 integration test (trần 55). DB dùng chung (ADR-034): chỉ tạo dữ liệu tạm có tiền tố RUN_PREFIX, email
// @example.test, dọn ở afterAll. Dòng audit_logs do createTenantForUser sinh ra không xoá được — chấp nhận (ADR-037).

const prisma = getPrismaClient();
const RUN_PREFIX = `adr043dash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const DAY = 86_400_000;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.test`;
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

describe("ADR-043 studio dashboard", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("dashboard: computes gross, net and refunded revenue by paid date and lists latest orders without customer email", async () => {
    const createUser = () =>
      prisma.user.create({ data: { email: nextEmail(), passwordHash: "not-used", status: "ACTIVE", emailVerifiedAt: new Date() } });
    const owner = await createUser();
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Dashboard Tenant", slug: `${RUN_PREFIX}-shop` });
    const buyerA = await createUser();
    const buyerB = await createUser(); // không có hồ sơ → hiện nhãn "Khách"
    await prisma.userProfile.create({ data: { userId: buyerA.id, fullName: "Nguyễn Văn Test", consentAt: new Date() } });

    const now = new Date();
    const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY);
    // Kỳ "7 ngày qua": hiện tại = 00:00 VN 6 ngày trước → now; kỳ trước = 7 ngày liền trước (cùng độ dài).
    const orders = [
      { buyer: buyerA, status: "FULFILLED" as const, unit: 120_000, total: 100_000, paidAt: at(2), createdAt: at(2) }, // trong kỳ, có giảm giá
      { buyer: buyerB, status: "REFUNDED" as const, unit: 50_000, total: 50_000, paidAt: at(1), createdAt: at(1) }, // trong kỳ, đã hoàn
      { buyer: buyerA, status: "PENDING" as const, unit: 70_000, total: 70_000, paidAt: null, createdAt: now }, // chưa trả
      { buyer: buyerA, status: "FULFILLED" as const, unit: 30_000, total: 30_000, paidAt: at(10), createdAt: at(10) }, // kỳ trước
      { buyer: buyerA, status: "FULFILLED" as const, unit: 999_000, total: 999_000, paidAt: at(40), createdAt: at(40) }, // ngoài cả hai kỳ
      { buyer: buyerB, status: "FULFILLED" as const, unit: 0, total: 0, paidAt: at(3), createdAt: at(3) }, // đơn 0đ → chỉ vào freeClaims
    ];
    const codes = await withTenant(tenant.id, async (tx) => {
      const product = await tx.product.create({ data: { tenantId: tenant.id, slug: "dashboard", title: "Dashboard Doc", status: "PUBLISHED" } });
      const created: string[] = [];
      for (const o of orders) {
        const order = await tx.order.create({
          data: {
            tenantId: tenant.id,
            customerId: o.buyer.id,
            code: generateOrderCode("TST"),
            status: o.status,
            subtotalVnd: o.unit,
            discountVnd: o.unit - o.total,
            totalVnd: o.total,
            expiresAt: new Date(now.getTime() + 60 * 60_000),
            paidAt: o.paidAt,
            createdAt: o.createdAt,
            items: { create: { productId: product.id, titleSnapshot: "Dashboard Doc", unitPriceVnd: o.unit, finalPriceVnd: o.total } },
          },
        });
        created.push(order.code);
      }
      return created;
    });

    const range = resolveDashboardRange({ ky: "7-ngay", now });
    const dashboard = await getTenantDashboard({ tenantId: tenant.id, range, now });

    expect(dashboard.sales.grossRevenueVnd).toEqual({ current: 150_000, previous: 30_000 });
    expect(dashboard.sales.netRevenueVnd).toEqual({ current: 100_000, previous: 30_000 });
    expect(dashboard.sales.refundedVnd).toEqual({ current: 50_000, previous: 0 });
    expect(dashboard.sales.paidOrders).toEqual({ current: 2, previous: 1 });
    expect(dashboard.sales.avgOrderVnd).toEqual({ current: 75_000, previous: 30_000 });
    expect(dashboard.sales.distinctProductsSold.current).toBe(1);
    expect(dashboard.sales.freeClaims).toEqual({ current: 1, previous: 0 });
    expect(dashboard.sales.pendingOrders).toBe(1);
    // Khách A có ≥2 đơn đã trả > 0đ tính tới hết kỳ (gồm đơn trước kỳ), B chỉ 1 (đơn 0đ không tính) → 1/2 quay lại.
    expect(dashboard.customers.buyers.current).toBe(2);
    expect(dashboard.customers.returningCustomerRate.current).toBe(0.5);
    // Chuỗi thời gian đủ 7 điểm ngày, cộng lại khớp tổng.
    expect(dashboard.series).toHaveLength(7);
    expect(dashboard.series.reduce((s, p) => s + p.grossRevenueVnd, 0)).toBe(150_000);
    expect(dashboard.series.reduce((s, p) => s + p.netRevenueVnd, 0)).toBe(100_000);
    expect(dashboard.products.topSelling).toEqual([
      // Loại đơn REFUNDED, vẫn gồm đơn 0đ: đơn 100.000 + đơn 0đ.
      expect.objectContaining({ title: "Dashboard Doc", orders: 2, revenueVnd: 100_000 }),
    ]);

    // 10 đơn mới nhất không lọc theo kỳ, mới → cũ, chỉ 5 trường, không email.
    expect(dashboard.latestOrders.map((o) => o.code)).toEqual([codes[2], codes[1], codes[0], codes[5], codes[3], codes[4]]);
    expect(dashboard.latestOrders[0]).toEqual({
      id: expect.any(String),
      code: codes[2],
      customerFullName: "Nguyễn Văn Test",
      unitPriceVnd: 70_000,
      totalVnd: 70_000,
    });
    expect(dashboard.latestOrders[1]).toMatchObject({ customerFullName: ANONYMOUS_CUSTOMER_LABEL, unitPriceVnd: 50_000 });
    expect(dashboard.latestOrders[2]).toMatchObject({ unitPriceVnd: 120_000, totalVnd: 100_000 });
    const serialized = JSON.stringify(dashboard.latestOrders);
    for (const secret of [owner.email, buyerA.email, buyerB.email, "@example.test"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
