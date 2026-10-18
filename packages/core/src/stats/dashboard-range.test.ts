import { listDashboardBuckets, resolveDashboardRange } from "./dashboard-range";

const iso = (d: Date) => d.toISOString();

describe("ADR-043 studio dashboard range", () => {
  it("resolves Vietnam-time boundaries for today, yesterday, Monday weeks, quarters and rejects custom ranges over 366 days", () => {
    // 10:00 Chủ nhật 18/10/2026 giờ VN.
    const now = new Date("2026-10-18T03:00:00.000Z");

    const today = resolveDashboardRange({ ky: "hom-nay", now });
    expect([iso(today.start), iso(today.end), iso(today.prevStart), iso(today.prevEnd)]).toEqual([
      "2026-10-17T17:00:00.000Z",
      "2026-10-18T03:00:00.000Z",
      "2026-10-16T17:00:00.000Z",
      "2026-10-17T03:00:00.000Z",
    ]);
    expect(today.granularity).toBe("hour");
    const hours = listDashboardBuckets(today);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toMatchObject({ key: "2026-10-18T00:00", label: "00:00", future: false });
    expect(hours.filter((b) => b.future)).toHaveLength(14); // 10:00 (bắt đầu đúng lúc now) → 23:00

    const yesterday = resolveDashboardRange({ ky: "hom-qua", now });
    expect([iso(yesterday.start), iso(yesterday.end), iso(yesterday.prevStart), iso(yesterday.prevEnd)]).toEqual([
      "2026-10-16T17:00:00.000Z",
      "2026-10-17T17:00:00.000Z",
      "2026-10-15T17:00:00.000Z",
      "2026-10-16T17:00:00.000Z",
    ]);

    // Tuần bắt đầu Thứ Hai: Chủ nhật 18/10 thuộc tuần từ 12/10; 00:30 Thứ Hai 19/10 VN (17:30 UTC Chủ nhật) đã sang tuần mới.
    const week = resolveDashboardRange({ ky: "tuan-nay", now });
    expect([iso(week.start), iso(week.prevStart), iso(week.prevEnd)]).toEqual([
      "2026-10-11T17:00:00.000Z",
      "2026-10-04T17:00:00.000Z",
      "2026-10-11T03:00:00.000Z",
    ]);
    expect(listDashboardBuckets(week).map((b) => b.label)).toEqual(["12/10", "13/10", "14/10", "15/10", "16/10", "17/10", "18/10"]);
    const mondayAfterMidnight = resolveDashboardRange({ ky: "tuan-nay", now: new Date("2026-10-18T17:30:00.000Z") });
    expect(iso(mondayAfterMidnight.start)).toBe("2026-10-18T17:00:00.000Z");

    const quarter = resolveDashboardRange({ ky: "quy-nay", now });
    expect([iso(quarter.start), iso(quarter.prevStart), quarter.granularity]).toEqual([
      "2026-09-30T17:00:00.000Z",
      "2026-06-30T17:00:00.000Z",
      "week",
    ]);
    expect(quarter.prevEnd.getTime() - quarter.prevStart.getTime()).toBe(quarter.end.getTime() - quarter.start.getTime());

    const custom = resolveDashboardRange({ ky: "tuy-chon", tu: "2026-10-01", den: "2026-10-10", now });
    expect([iso(custom.start), iso(custom.end), iso(custom.prevStart), iso(custom.prevEnd), custom.granularity, custom.invalid]).toEqual([
      "2026-09-30T17:00:00.000Z",
      "2026-10-10T17:00:00.000Z",
      "2026-09-20T17:00:00.000Z",
      "2026-09-30T17:00:00.000Z",
      "day",
      false,
    ]);

    // Quá 366 ngày, `den` sau hôm nay, hoặc `ky` lạ → mặc định 30 ngày qua + cờ lỗi; không có `ky` → mặc định, không lỗi.
    for (const bad of [
      { ky: "tuy-chon", tu: "2025-10-17", den: "2026-10-18" },
      { ky: "tuy-chon", tu: "2026-10-01", den: "2026-10-19" },
      { ky: ["khong-ton-tai"] },
    ]) {
      const fallback = resolveDashboardRange({ ...bad, now });
      expect([fallback.key, fallback.invalid, iso(fallback.start)]).toEqual(["30-ngay", true, "2026-09-18T17:00:00.000Z"]);
    }
    const defaults = resolveDashboardRange({ now });
    expect([defaults.key, defaults.invalid, listDashboardBuckets(defaults).length]).toEqual(["30-ngay", false, 30]);
    expect(resolveDashboardRange({ ky: "tuy-chon", tu: "2025-10-18", den: "2026-10-18", now }).invalid).toBe(false);
  });
});
