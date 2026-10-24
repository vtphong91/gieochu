"use client";

import { useState, useTransition, useMemo } from "react";
import { Badge, GhostButton, PrimaryButton, FormBanner } from "../../_ui/kit";
import {
  IconCloud,
  IconServer,
  IconDatabase,
  IconPlus,
  IconRefresh,
} from "../../_ui/icons";

import {
  provisionTenantBucketAction,
  inspectTenantBucketAction,
  reconcileTenantStorageAction,
  reconcileAllTenantsStorageAction,
} from "./actions";
import type { TenantBucketInspectionResult } from "../../../../lib/tenant-storage";

export interface BucketMonitoringTenant {
  id: string;
  name: string;
  slug: string;
  storageBucket?: string | null;
  storageProvider?: string | null;
  storageUsedBytes: number;
  planCode?: string;
  planName?: string;
  planStorageMb?: number;
  fileCount?: number;
  status: string;
}

export function BucketMonitoring({ initialTenants = [] }: { initialTenants?: BucketMonitoringTenant[] }) {
  const [tenants, setTenants] = useState<BucketMonitoringTenant[]>(initialTenants);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"ALL" | "CLOUDFLARE_R2" | "MINIO">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "READY" | "PENDING" | "WARNING">("ALL");
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [inspectingTenantId, setInspectingTenantId] = useState<string | null>(null);
  const [reconcilingTenantId, setReconcilingTenantId] = useState<string | null>(null);
  const [isReconcilingAll, setIsReconcilingAll] = useState(false);
  const [inspectionResults, setInspectionResults] = useState<Record<string, TenantBucketInspectionResult>>({});
  const [isPending, startTransition] = useTransition();

  // Helper format dung lượng bytes sang MB / GB
  function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  }

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const totalTenants = tenants.length;
    const withBucket = tenants.filter((t) => Boolean(t.storageBucket)).length;
    const totalBytes = tenants.reduce((acc, t) => acc + (t.storageUsedBytes || 0), 0);
    const nearLimit = tenants.filter((t) => {
      const quotaMb = t.planStorageMb || 500;
      const usedMb = (t.storageUsedBytes || 0) / (1024 * 1024);
      return usedMb / quotaMb >= 0.8;
    }).length;

    return {
      totalTenants,
      withBucket,
      coveragePercent: totalTenants > 0 ? Math.round((withBucket / totalTenants) * 100) : 0,
      totalStorageFormatted: formatBytes(totalBytes),
      nearLimit,
    };
  }, [tenants]);

  // Bộ lọc dữ liệu
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.storageBucket && t.storageBucket.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (platformFilter !== "ALL") {
        const provider = t.storageProvider ?? "CLOUDFLARE_R2";
        if (provider !== platformFilter) return false;
      }

      if (statusFilter !== "ALL") {
        const hasBucket = Boolean(t.storageBucket);
        const quotaMb = t.planStorageMb || 500;
        const usedMb = (t.storageUsedBytes || 0) / (1024 * 1024);
        const ratio = usedMb / quotaMb;

        if (statusFilter === "PENDING" && hasBucket) return false;
        if (statusFilter === "READY" && (!hasBucket || ratio >= 0.8)) return false;
        if (statusFilter === "WARNING" && ratio < 0.8) return false;
      }

      return true;
    });
  }, [tenants, searchQuery, platformFilter, statusFilter]);

  // Khởi tạo bucket cho gian hàng
  function handleProvisionBucket(tenantId: string) {
    setPendingTenantId(tenantId);
    setActionMessage(null);

    startTransition(async () => {
      const result = await provisionTenantBucketAction(tenantId);
      setActionMessage({
        ok: result.ok,
        message: result.message ?? (result.ok ? "Đã khởi tạo bucket thành công." : "Khởi tạo thất bại."),
      });
      setPendingTenantId(null);

      if (result.ok) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenantId
              ? {
                  ...t,
                  storageBucket: t.storageBucket ?? result.bucketName ?? null,
                  storageProvider: t.storageProvider ?? "CLOUDFLARE_R2",
                }
              : t
          )
        );
      }
    });
  }

  // Kiểm tra sức khỏe & số liệu thực tế của Bucket trên Storage (MinIO / R2)
  function handleInspectBucket(tenantId: string) {
    setInspectingTenantId(tenantId);
    setActionMessage(null);

    startTransition(async () => {
      const result = await inspectTenantBucketAction(tenantId);
      setInspectionResults((prev) => ({ ...prev, [tenantId]: result }));
      setActionMessage({
        ok: result.ok,
        message: result.message,
      });
      setInspectingTenantId(null);
    });
  }

  // Đối soát & cập nhật dung lượng DB theo số liệu thực tế trên Storage
  function handleReconcileTenant(tenantId: string) {
    setReconcilingTenantId(tenantId);
    setActionMessage(null);

    startTransition(async () => {
      const result = await reconcileTenantStorageAction(tenantId);
      setInspectionResults((prev) => ({ ...prev, [tenantId]: result }));
      setActionMessage({
        ok: result.ok,
        message: result.message,
      });
      setReconcilingTenantId(null);

      if (result.ok && result.bucketExists) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === tenantId
              ? {
                  ...t,
                  storageUsedBytes: result.storageTotalBytes,
                  fileCount: result.dbFilesCount,
                }
              : t
          )
        );
      }
    });
  }

  // Quét và đồng bộ toàn bộ gian hàng
  function handleReconcileAll() {
    setIsReconcilingAll(true);
    setActionMessage(null);

    startTransition(async () => {
      const result = await reconcileAllTenantsStorageAction();
      setActionMessage({
        ok: result.ok,
        message: result.message,
      });
      setIsReconcilingAll(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. Thẻ thống kê tổng quan (Metrics Summary) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng gian hàng</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{stats.totalTenants}</span>
            <span className="text-xs text-gray-500">cửa hàng</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Dedicated Buckets</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0F3B82]">{stats.withBucket}</span>
            <span className="text-xs text-gray-500">({stats.coveragePercent}% đã cấp)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng dung lượng dùng</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{stats.totalStorageFormatted}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cần chú ý / Sắp đầy</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.nearLimit > 0 ? "text-amber-600" : "text-gray-900"}`}>
              {stats.nearLimit}
            </span>
            <span className="text-xs text-gray-500">gian hàng (&gt;80%)</span>
          </div>
        </div>
      </div>

      {/* Thông báo thao tác */}
      {actionMessage ? (
        <FormBanner ok={actionMessage.ok} message={actionMessage.message} />
      ) : null}

      {/* 2. Thanh tìm kiếm và bộ lọc */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên gian hàng, slug hoặc tên bucket..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none transition focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as "ALL" | "CLOUDFLARE_R2" | "MINIO")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-[#0F3B82]"
          >
            <option value="ALL">Mọi nền tảng</option>
            <option value="CLOUDFLARE_R2">Cloudflare R2</option>
            <option value="MINIO">MinIO</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "READY" | "PENDING" | "WARNING")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-[#0F3B82]"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="READY">Sẵn sàng</option>
            <option value="WARNING">Sắp đầy / Quá tải</option>
            <option value="PENDING">Chưa cấp phát</option>
          </select>

          <GhostButton
            loading={isReconcilingAll}
            onClick={handleReconcileAll}
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-[#0F3B82] font-semibold whitespace-nowrap">
              <IconRefresh className="w-3.5 h-3.5" />
              <span>Khớp dữ liệu Storage</span>
            </span>
          </GhostButton>
        </div>
      </div>

      {/* 3. Danh sách Buckets (Bảng trên Desktop, Cards trên Mobile) */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        {filteredTenants.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <IconDatabase className="w-10 h-10 mx-auto text-gray-300 stroke-1" />
            <p className="mt-3 text-sm font-medium">Không tìm thấy gian hàng phù hợp</p>
            <p className="mt-1 text-xs text-gray-400">Thử thay đổi từ khoá tìm kiếm hoặc đặt lại bộ lọc.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Gian hàng</th>
                    <th className="py-3.5 px-4">Tên Bucket</th>
                    <th className="py-3.5 px-4">Nền tảng</th>
                    <th className="py-3.5 px-4 text-center">Số tệp</th>
                    <th className="py-3.5 px-4">Dung lượng / Hạn mức</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTenants.map((t) => {
                    const quotaMb = t.planStorageMb || 500;
                    const usedMb = Math.round((t.storageUsedBytes || 0) / (1024 * 1024));
                    const percentage = Math.min(100, Math.round((usedMb / quotaMb) * 100));

                    const isWarning = percentage >= 80 && percentage < 95;
                    const isDanger = percentage >= 95;
                    const hasBucket = Boolean(t.storageBucket);

                    let barColor = "bg-emerald-500";
                    if (isWarning) barColor = "bg-amber-500";
                    if (isDanger) barColor = "bg-red-500";

                    return (
                      <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{t.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">/{t.slug}</span>
                            <span className="text-[11px] font-medium text-gray-500 px-1.5 py-0.2 bg-gray-100 rounded">
                              {t.planName || "Gói cơ bản"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs">
                          {hasBucket ? (
                            <span className="text-[#0F3B82] bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100">
                              {t.storageBucket}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Chưa cấp phát</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {t.storageProvider === "MINIO" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                              <IconServer className="w-3.5 h-3.5" />
                              <span>MinIO</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              <IconCloud className="w-3.5 h-3.5" />
                              <span>Cloudflare R2</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center font-medium text-gray-700">
                          {t.fileCount ?? 0} tệp
                        </td>

                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{usedMb} MB</span>
                            <span className="text-gray-400">{quotaMb} MB ({percentage}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {!hasBucket ? (
                            <Badge tone="neutral">Chưa có bucket</Badge>
                          ) : isDanger ? (
                            <Badge tone="danger">Quá hạn mức</Badge>
                          ) : isWarning ? (
                            <Badge tone="warning">Sắp đầy</Badge>
                          ) : (
                            <Badge tone="success">Sẵn sàng</Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {!hasBucket ? (
                            <PrimaryButton
                              loading={isPending && pendingTenantId === t.id}
                              onClick={() => handleProvisionBucket(t.id)}
                            >
                              <span className="inline-flex items-center gap-1 text-xs">
                                <IconPlus className="w-3.5 h-3.5" />
                                <span>Khởi tạo bucket</span>
                              </span>
                            </PrimaryButton>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <GhostButton
                                loading={isPending && inspectingTenantId === t.id}
                                onClick={() => handleInspectBucket(t.id)}
                              >
                                <span className="text-xs">Kiểm tra</span>
                              </GhostButton>
                              <GhostButton
                                loading={isPending && reconcilingTenantId === t.id}
                                onClick={() => handleReconcileTenant(t.id)}
                                title="Đồng bộ lại dung lượng thực tế từ Storage vào Database"
                              >
                                <span className="inline-flex items-center gap-1 text-xs text-[#0F3B82]">
                                  <IconRefresh className="w-3 h-3" />
                                  <span>Đồng bộ</span>
                                </span>
                              </GhostButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredTenants.map((t) => {
                const quotaMb = t.planStorageMb || 500;
                const usedMb = Math.round((t.storageUsedBytes || 0) / (1024 * 1024));
                const percentage = Math.min(100, Math.round((usedMb / quotaMb) * 100));
                const hasBucket = Boolean(t.storageBucket);

                return (
                  <div key={t.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-900">{t.name}</div>
                        <div className="text-xs text-gray-400">/{t.slug} • {t.planName || "Gói cơ bản"}</div>
                      </div>
                      <div>
                        {t.storageProvider === "MINIO" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700">
                            MinIO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">
                            R2
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs">
                      <span className="text-gray-400 block mb-0.5">Bucket:</span>
                      {hasBucket ? (
                        <span className="font-mono text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {t.storageBucket}
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Chưa khởi tạo bucket riêng</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Dung lượng đã dùng: {usedMb} MB / {quotaMb} MB</span>
                        <span>{percentage}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            percentage >= 95 ? "bg-red-500" : percentage >= 80 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">{t.fileCount ?? 0} tệp đã lưu</span>
                      {!hasBucket ? (
                        <PrimaryButton
                          loading={isPending && pendingTenantId === t.id}
                          onClick={() => handleProvisionBucket(t.id)}
                        >
                          <span className="text-xs">Khởi tạo bucket</span>
                        </PrimaryButton>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <GhostButton
                            loading={isPending && inspectingTenantId === t.id}
                            onClick={() => handleInspectBucket(t.id)}
                          >
                            <span className="text-xs">Kiểm tra</span>
                          </GhostButton>
                          <GhostButton
                            loading={isPending && reconcilingTenantId === t.id}
                            onClick={() => handleReconcileTenant(t.id)}
                          >
                            <span className="text-xs text-[#0F3B82]">Đồng bộ</span>
                          </GhostButton>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Hiển thị {filteredTenants.length} trên tổng số {tenants.length} gian hàng</span>
        <span>Dedicated Bucket quy chuẩn: gc-tenant-[tenantId] (ADR-038)</span>
      </div>
    </div>
  );
}
