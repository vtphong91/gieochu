import { getPrismaClient } from "@gieochu/db";
import { addDays, isStatsTableMissing, vnDateString } from "./tenant-stats";

/**
 * ADR-037 (M12b) — số liệu tổng hợp toàn nền tảng cho dashboard System Admin.
 *
 * §7.9: CHỈ đọc `tenant_daily_stats` (L1, không RLS — bảng tổng hợp do job `stats.aggregate` ghi) và `tenants` (tên/slug).
 * Không bao giờ đọc `orders`/`order_items`/`tenant_customers`/`download_events`. Nơi gọi phải `requireRole` SYSTEM_ADMIN.
 *
 * Cửa sổ `days` ngày kết thúc ở **hôm qua** (giờ VN): cron chạy 03:00 nên số của hôm nay mới phản ánh vài giờ đầu ngày —
 * dashboard ghi "số liệu đến hết hôm qua / lần tổng hợp gần nhất" (ADR-037 mục 5). `prevTotals` = `days` ngày liền trước.
 * Tiền (BIGINT) trả dạng chuỗi số nguyên VND.
 */

export interface AdminStatsTotals {
  gmvVnd: string;
  ordersPaid: number;
  newCustomers: number;
  downloads: number;
}

export interface AdminStatsSeriesPoint extends AdminStatsTotals {
  /** YYYY-MM-DD (ngày giờ VN). */
  date: string;
}

export interface AdminStatsTopTenant {
  tenantId: string;
  name: string;
  slug: string;
  gmvVnd: string;
  ordersPaid: number;
}

export type AdminStatsOverview =
  | { status: "unavailable" }
  | {
      status: "ok";
      /** ISO-8601 UTC của lần ghi gần nhất vào bảng; null khi bảng chưa có dòng nào. */
      lastAggregatedAt: string | null;
      totals: AdminStatsTotals;
      prevTotals: AdminStatsTotals;
      /** Đủ `days` ngày, cũ → mới; ngày không có dòng = 0. */
      series: AdminStatsSeriesPoint[];
      /** Tối đa 5 tenant theo GMV trong cửa sổ hiện tại (chỉ tenant có GMV > 0). */
      topTenants: AdminStatsTopTenant[];
    };

const TOP_TENANTS = 5;

function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function emptyTotals(): { gmvVnd: bigint; ordersPaid: number; newCustomers: number; downloads: number } {
  return { gmvVnd: 0n, ordersPaid: 0, newCustomers: 0, downloads: 0 };
}

export async function getAdminStatsOverview(options: { days?: number; now?: Date } = {}): Promise<AdminStatsOverview> {
  const days = Math.max(1, Math.min(366, Math.trunc(options.days ?? 30)));
  const endDate = addDays(vnDateString(options.now ?? new Date()), -1);
  const startDate = addDays(endDate, -(days - 1));
  const prevEndDate = addDays(startDate, -1);
  const prevStartDate = addDays(prevEndDate, -(days - 1));
  const prisma = getPrismaClient();

  try {
    const [byDate, top, latest] = await Promise.all([
      prisma.tenantDailyStat.groupBy({
        by: ["date"],
        where: { date: { gte: toDbDate(prevStartDate), lte: toDbDate(endDate) } },
        _sum: { gmvVnd: true, ordersPaid: true, newCustomers: true, downloads: true },
      }),
      prisma.tenantDailyStat.groupBy({
        by: ["tenantId"],
        where: { date: { gte: toDbDate(startDate), lte: toDbDate(endDate) } },
        _sum: { gmvVnd: true, ordersPaid: true },
        having: { gmvVnd: { _sum: { gt: 0 } } },
        orderBy: [{ _sum: { gmvVnd: "desc" } }, { tenantId: "asc" }],
        take: TOP_TENANTS,
      }),
      prisma.tenantDailyStat.aggregate({ _max: { updatedAt: true } }),
    ]);

    const tenants = top.length
      ? await prisma.tenant.findMany({
          where: { id: { in: top.map((t) => t.tenantId) } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const sumsByDate = new Map(byDate.map((row) => [row.date.toISOString().slice(0, 10), row._sum]));
    const totals = emptyTotals();
    const prevTotals = emptyTotals();
    const series: AdminStatsSeriesPoint[] = [];

    for (let date = prevStartDate; date <= endDate; date = addDays(date, 1)) {
      const sum = sumsByDate.get(date);
      const point = {
        gmvVnd: sum?.gmvVnd ?? 0n,
        ordersPaid: sum?.ordersPaid ?? 0,
        newCustomers: sum?.newCustomers ?? 0,
        downloads: sum?.downloads ?? 0,
      };
      const bucket = date >= startDate ? totals : prevTotals;
      bucket.gmvVnd += point.gmvVnd;
      bucket.ordersPaid += point.ordersPaid;
      bucket.newCustomers += point.newCustomers;
      bucket.downloads += point.downloads;
      if (date >= startDate) series.push({ date, ...point, gmvVnd: point.gmvVnd.toString() });
    }

    const topTenants: AdminStatsTopTenant[] = top.flatMap((row) => {
      const tenant = tenantById.get(row.tenantId);
      if (!tenant) return [];
      return [
        {
          tenantId: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          gmvVnd: (row._sum.gmvVnd ?? 0n).toString(),
          ordersPaid: row._sum.ordersPaid ?? 0,
        },
      ];
    });

    return {
      status: "ok",
      lastAggregatedAt: latest._max.updatedAt ? latest._max.updatedAt.toISOString() : null,
      totals: { ...totals, gmvVnd: totals.gmvVnd.toString() },
      prevTotals: { ...prevTotals, gmvVnd: prevTotals.gmvVnd.toString() },
      series,
      topTenants,
    };
  } catch (error) {
    // Code lên trước migration M12b: bảng chưa có → dashboard hiện trạng thái "chưa có số liệu", không 500.
    if (isStatsTableMissing(error)) return { status: "unavailable" };
    throw error;
  }
}
