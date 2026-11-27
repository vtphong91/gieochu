import { afterAll, describe, expect, it } from "vitest";
import { generateOrderCode } from "@gieochu/core";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { aggregateTenantDailyStats, addDays, vnDateString } from "../../lib/tenant-stats";
import { getAdminStatsOverview } from "../../lib/admin-stats";
import { escapeContainsValue } from "../../lib/prisma-contains";
import type { CurrentUser } from "../../lib/session";

// ADR-037 (M12b) — đặc tả M12 test integration #2. DB dùng chung (ADR-034): aggregate chỉ chạy cho tenant tạm của test
// (`tenantIds`) để không ghi đè dòng thống kê của tenant khác; dữ liệu tạm dọn ở afterAll (tenant_daily_stats xoá theo
// CASCADE của tenant). Dòng audit_logs do createTenantForUser sinh ra không xoá được — chấp nhận (ADR-037).

const prisma = getPrismaClient();
const RUN_PREFIX = `m12stats_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
// slugify() đổi "_" thành "-" → slug tenant tạm bắt đầu bằng SLUG_PREFIX (không phải RUN_PREFIX). Dọn dẹp trước đây khớp
// được chỉ nhờ "_" trong LIKE là wildcard (Prisma không escape) — mong manh; nay dùng đúng tiền tố + escape wildcard.
const SLUG_PREFIX = RUN_PREFIX.replace(/_/g, "-");
const EMAIL_PREFIX = escapeContainsValue(RUN_PREFIX);
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

/** Thời điểm UTC tương ứng giờ VN (UTC+7, không có giờ mùa hè) `hh:mm` của ngày `date`. */
function vnTime(date: string, hh: number, mm: number): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + ((hh - 7) * 60 + mm) * 60_000);
}

const ALLOWED_COLUMNS = ["date", "downloads", "gmvVnd", "id", "newCustomers", "ordersPaid", "tenantId", "updatedAt"];

describe("M12 stats", () => {
  afterAll(async () => {
    // Tenant tạm theo slug HOẶC theo chủ sở hữu có email tạm (phòng test lỗi giữa chừng sau khi tạo user).
    const tenants = await prisma.tenant.findMany({
      where: { OR: [{ slug: { startsWith: SLUG_PREFIX } }, { owner: { email: { startsWith: EMAIL_PREFIX } } }] },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.downloadEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantCustomer.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.productFile.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    if (tenantIds.length > 0) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  });

  it("stats: daily aggregation writes tenant_daily_stats without personal data and admin dashboard can read it", async () => {
    const owner = await prisma.user.create({
      data: { email: nextEmail(), passwordHash: "not-used", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const created = await createTenantForUser(toCurrentUser(owner.id), { name: "Stats Tenant", slug: `${SLUG_PREFIX}-shop` });
    const tenantId = created.id;
    const buyerA = await prisma.user.create({
      data: { email: nextEmail(), passwordHash: "not-used", status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    const buyerB = await prisma.user.create({
      data: { email: nextEmail(), passwordHash: "not-used", status: "ACTIVE", emailVerifiedAt: new Date() },
    });

    // Ngày D nằm trong cửa sổ 30 ngày của dashboard (kết thúc hôm qua giờ VN); D-1 dùng để kiểm biên nửa đêm.
    const day = addDays(vnDateString(new Date()), -3);
    const prevDay = addDays(day, -1);
    const BIG = 1_500_000_000; // 2 đơn × 1,5 tỷ → tổng vượt INT32, kiểm BIGINT.

    const orderCodes: string[] = [];
    await withTenant(tenantId, async (tx) => {
      const orders = [
        { status: "FULFILLED" as const, totalVnd: BIG, paidAt: vnTime(day, 0, 30) }, // 00:30 VN ngày D (= 17:30 UTC D-1)
        { status: "REFUNDED" as const, totalVnd: BIG, paidAt: vnTime(day, 23, 30) }, // GMV gộp: đơn hoàn vẫn tính
        { status: "FULFILLED" as const, totalVnd: 10_000, paidAt: vnTime(prevDay, 23, 30) }, // 23:30 VN ngày D-1
        { status: "PENDING" as const, totalVnd: 99_000, paidAt: null }, // chưa trả → không tính
      ];
      for (const [index, o] of orders.entries()) {
        const order = await tx.order.create({
          data: {
            tenantId,
            customerId: index % 2 === 0 ? buyerA.id : buyerB.id,
            code: generateOrderCode("TST"),
            status: o.status,
            subtotalVnd: o.totalVnd,
            totalVnd: o.totalVnd,
            expiresAt: new Date(Date.now() + 60_000),
            paidAt: o.paidAt,
          },
        });
        orderCodes.push(order.code);
      }
      await tx.tenantCustomer.create({
        data: { tenantId, userId: buyerA.id, ordersCount: 2, totalSpentVnd: 0, firstOrderAt: vnTime(day, 0, 30), lastOrderAt: vnTime(day, 0, 30) },
      });
      await tx.tenantCustomer.create({
        data: { tenantId, userId: buyerB.id, ordersCount: 1, totalSpentVnd: 0, firstOrderAt: vnTime(prevDay, 23, 30), lastOrderAt: vnTime(day, 23, 30) },
      });
      const product = await tx.product.create({ data: { tenantId, slug: "stats", title: "Stats", status: "PUBLISHED" } });
      const file = await tx.productFile.create({
        data: {
          productId: product.id,
          tenantId,
          objectKey: `${tenantId}/${product.id}/${RUN_PREFIX}.pdf`,
          fileName: "stats.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          scanStatus: "CLEAN",
        },
      });
      for (const at of [vnTime(day, 8, 0), vnTime(day, 23, 59), vnTime(prevDay, 12, 0)]) {
        await tx.downloadEvent.create({ data: { tenantId, fileId: file.id, userId: buyerA.id, ip: "203.0.113.9", createdAt: at } });
      }
    });

    // Ảnh chụp dashboard trước khi tổng hợp — sau đó so phần tăng đúng bằng đóng góp của tenant tạm (không phụ thuộc
    // dữ liệu các tenant khác trên DB dùng chung).
    const before = await getAdminStatsOverview({ days: 30 });
    expect(before.status).toBe("ok");
    if (before.status !== "ok") return;

    // Chạy 2 lần: upsert idempotent, không nhân đôi dòng hay số liệu.
    expect(await aggregateTenantDailyStats({ fromDate: prevDay, toDate: day, tenantIds: [tenantId] })).toBe(2);
    expect(await aggregateTenantDailyStats({ fromDate: prevDay, toDate: day, tenantIds: [tenantId] })).toBe(2);

    const rows = await prisma.tenantDailyStat.findMany({ where: { tenantId }, orderBy: { date: "asc" } });
    expect(
      rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        ordersPaid: r.ordersPaid,
        gmvVnd: r.gmvVnd,
        newCustomers: r.newCustomers,
        downloads: r.downloads,
      })),
    ).toEqual([
      { date: prevDay, ordersPaid: 1, gmvVnd: 10_000n, newCustomers: 1, downloads: 1 },
      { date: day, ordersPaid: 2, gmvVnd: 3_000_000_000n, newCustomers: 1, downloads: 2 },
    ]);

    // Không dữ liệu cá nhân: đúng danh sách cột số liệu, và giá trị không chứa email/mã đơn/IP.
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name::text AS column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_daily_stats'
      ORDER BY column_name
    `;
    expect(columns.map((c) => c.column_name).sort()).toEqual(ALLOWED_COLUMNS);
    const serialized = JSON.stringify(rows, (_key, value: unknown) => (typeof value === "bigint" ? value.toString() : value));
    for (const secret of [owner.email, buyerA.email, buyerB.email, buyerA.id, buyerB.id, "203.0.113.9", ...orderCodes]) {
      expect(serialized).not.toContain(secret);
    }

    // Dashboard admin đọc được (chỉ tenant_daily_stats + tenants): series/totals tăng đúng phần của tenant tạm.
    const overview = await getAdminStatsOverview({ days: 30 });
    expect(overview.status).toBe("ok");
    if (overview.status !== "ok") return;
    expect(overview.series).toHaveLength(30);
    expect(overview.lastAggregatedAt).not.toBeNull();
    const delta = (date: string) => {
      const a = before.series.find((p) => p.date === date)!;
      const b = overview.series.find((p) => p.date === date)!;
      return {
        gmvVnd: BigInt(b.gmvVnd) - BigInt(a.gmvVnd),
        ordersPaid: b.ordersPaid - a.ordersPaid,
        newCustomers: b.newCustomers - a.newCustomers,
        downloads: b.downloads - a.downloads,
      };
    };
    expect(delta(day)).toEqual({ gmvVnd: 3_000_000_000n, ordersPaid: 2, newCustomers: 1, downloads: 2 });
    expect(delta(prevDay)).toEqual({ gmvVnd: 10_000n, ordersPaid: 1, newCustomers: 1, downloads: 1 });
    expect({
      gmvVnd: BigInt(overview.totals.gmvVnd) - BigInt(before.totals.gmvVnd),
      ordersPaid: overview.totals.ordersPaid - before.totals.ordersPaid,
      newCustomers: overview.totals.newCustomers - before.totals.newCustomers,
      downloads: overview.totals.downloads - before.totals.downloads,
    }).toEqual({ gmvVnd: 3_000_010_000n, ordersPaid: 3, newCustomers: 2, downloads: 3 });

    // Top gian hàng: chỉ kiểm cấu trúc (thứ hạng phụ thuộc dữ liệu thật) — tên/slug + số tổng hợp, tiền dạng chuỗi.
    expect(overview.topTenants.length).toBeLessThanOrEqual(5);
    for (const t of overview.topTenants) {
      expect(Object.keys(t).sort()).toEqual(["gmvVnd", "name", "ordersPaid", "slug", "tenantId"]);
      expect(typeof t.name).toBe("string");
      expect(typeof t.slug).toBe("string");
      expect(t.gmvVnd).toMatch(/^\d+$/);
    }
  });
});
