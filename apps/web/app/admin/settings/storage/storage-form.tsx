"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveStorageConfigAction, testStorageConnectionAction, type StorageActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, GhostButton, PrimaryButton, TextField, Toggle } from "../../_ui/kit";
import { IconCloud, IconServer, IconCheckCircle, IconAlertTriangle } from "../../_ui/icons";

const initialState: StorageActionState = {};

export interface StorageFormInitial {
  activeProvider?: "CLOUDFLARE_R2" | "MINIO";
  isEnabled: boolean;
  lastVerifiedAt: string | null;
  endpoint?: string;
  region?: string;
  bucketPrivate?: string;
  bucketPublic?: string;
  publicBaseUrl?: string;
  maskedAccessKeyId?: string;
  maskedSecretAccessKey?: string;
  maxUploadMb?: number;
  r2?: {
    endpoint: string;
    region: string;
    bucketPrivate: string;
    bucketPublic: string;
    publicBaseUrl: string;
    maskedAccessKeyId?: string;
    maskedSecretAccessKey?: string;
    maxUploadMb?: number;
  };
  minio?: {
    host: string;
    port: number;
    useSSL: boolean;
    region: string;
    bucketPrefix: string;
    publicBaseUrl: string;
    maskedAccessKeyId?: string;
    maskedSecretAccessKey?: string;
    maxUploadMb?: number;
  };
}

export function StorageForm({ initial }: { initial: StorageFormInitial }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(saveStorageConfigAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();

  // Active provider determines which backend serves new uploads
  const defaultProvider = initial.activeProvider ?? "CLOUDFLARE_R2";
  const [activeProvider, setActiveProvider] = useState<"CLOUDFLARE_R2" | "MINIO">(defaultProvider);

  // Tab currently being edited in the form
  const [activeTab, setActiveTab] = useState<"CLOUDFLARE_R2" | "MINIO">(defaultProvider);

  // MinIO SSL toggle state
  const [minioUseSsl, setMinioUseSsl] = useState<boolean>(initial.minio?.useSSL ?? false);

  // Resolved values for R2
  const r2Endpoint = initial.r2?.endpoint ?? initial.endpoint ?? "";
  const r2Region = initial.r2?.region ?? initial.region ?? "auto";
  const r2BucketPrivate = initial.r2?.bucketPrivate ?? initial.bucketPrivate ?? "";
  const r2BucketPublic = initial.r2?.bucketPublic ?? initial.bucketPublic ?? "";
  const r2PublicBaseUrl = initial.r2?.publicBaseUrl ?? initial.publicBaseUrl ?? "";
  const r2MaskedAccessKey = initial.r2?.maskedAccessKeyId ?? initial.maskedAccessKeyId;
  const r2MaskedSecretKey = initial.r2?.maskedSecretAccessKey ?? initial.maskedSecretAccessKey;
  const r2MaxUploadMb = initial.r2?.maxUploadMb ?? initial.maxUploadMb ?? 500;

  // Resolved values for MinIO
  const minioHost = initial.minio?.host ?? "localhost";
  const minioPort = initial.minio?.port ?? 9000;
  const minioRegion = initial.minio?.region ?? "us-east-1";
  const minioBucketPrefix = initial.minio?.bucketPrefix ?? "gc-";
  const minioPublicBaseUrl = initial.minio?.publicBaseUrl ?? "";
  const minioMaskedAccessKey = initial.minio?.maskedAccessKeyId;
  const minioMaskedSecretKey = initial.minio?.maskedSecretAccessKey;
  const minioMaxUploadMb = initial.minio?.maxUploadMb ?? 500;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Hidden input to pass chosen active provider to Server Action */}
      <input type="hidden" name="activeProvider" value={activeProvider} />

      {/* 1. Selector chọn Nền tảng lưu trữ chính (Active Provider) */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-gray-900">
              Nền tảng lưu trữ chính (Active Provider)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Hệ thống sẽ ưu tiên lưu trữ các tài liệu và ảnh bìa mới tải lên trên nền tảng được chọn (theo ADR-038).
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Kích hoạt lưu trữ hệ thống" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card R2 */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider("CLOUDFLARE_R2");
              setActiveTab("CLOUDFLARE_R2");
            }}
            className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
              activeProvider === "CLOUDFLARE_R2"
                ? "border-[#0F3B82] bg-blue-50/40 shadow-xs ring-1 ring-[#0F3B82]/20"
                : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeProvider === "CLOUDFLARE_R2" ? "bg-[#0F3B82] text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              <IconCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-gray-900">Cloudflare R2</span>
                {activeProvider === "CLOUDFLARE_R2" ? (
                  <Badge tone="success">Đang dùng</Badge>
                ) : (
                  <Badge tone="neutral">Dự phòng</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                Lưu trữ đám mây toàn cầu, tương thích S3, không phí băng thông tải về (Zero Egress).
              </p>
            </div>
          </button>

          {/* Card MinIO */}
          <button
            type="button"
            onClick={() => {
              setActiveProvider("MINIO");
              setActiveTab("MINIO");
            }}
            className={`flex items-start gap-3.5 p-4 rounded-xl border text-left transition-all ${
              activeProvider === "MINIO"
                ? "border-[#0F3B82] bg-blue-50/40 shadow-xs ring-1 ring-[#0F3B82]/20"
                : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50"
            }`}
          >
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                activeProvider === "MINIO" ? "bg-[#0F3B82] text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              <IconServer className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-gray-900">MinIO (Self-hosted)</span>
                {activeProvider === "MINIO" ? (
                  <Badge tone="success">Đang dùng</Badge>
                ) : (
                  <Badge tone="neutral">Dự phòng</Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                Hạ tầng lưu trữ S3 tự host trên máy chủ riêng hoặc On-Premises, kiểm soát dữ liệu tuyệt đối.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* 2. Navigation Tabs cấu hình chi tiết cho từng Provider */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("CLOUDFLARE_R2")}
          className={`pb-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "CLOUDFLARE_R2"
              ? "border-[#0F3B82] text-[#0F3B82]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <IconCloud className="w-4 h-4" />
          <span>Cấu hình Cloudflare R2</span>
          {activeProvider === "CLOUDFLARE_R2" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đang là nền tảng chính" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("MINIO")}
          className={`pb-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "MINIO"
              ? "border-[#0F3B82] text-[#0F3B82]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <IconServer className="w-4 h-4" />
          <span>Cấu hình MinIO</span>
          {activeProvider === "MINIO" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Đang là nền tảng chính" />
          )}
        </button>
      </div>

      {/* 3. Panel Form Cloudflare R2 */}
      <div className={activeTab === "CLOUDFLARE_R2" ? "block" : "hidden"}>
        <ConfigCard
          icon={<IconCloud className="h-5 w-5" />}
          title="Cloudflare R2 (S3-compatible API)"
          badges={
            <>
              {activeProvider === "CLOUDFLARE_R2" ? (
                <Badge tone="info">Nền tảng chính</Badge>
              ) : (
                <Badge tone="neutral">Kênh phụ</Badge>
              )}
              <Badge tone={initial.isEnabled ? "success" : "neutral"}>
                {initial.isEnabled ? "Đang bật" : "Đang tắt"}
              </Badge>
              {initial.lastVerifiedAt ? <Badge tone="info">Đã xác minh</Badge> : null}
            </>
          }
          description={
            initial.lastVerifiedAt
              ? `Đã kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.`
              : "Lưu file tài liệu tải về (bucket private) và ảnh bìa sản phẩm (bucket public) toàn hệ thống."
          }
          footer={
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Đổi endpoint/bucket/access key sẽ tự tắt kết nối này — lưu lại lần nữa (đã tích &quot;Kích hoạt&quot;) hoặc bấm &quot;Kiểm tra kết nối&quot; để xác nhận (ADR-017).
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextField
                id="r2-endpoint"
                label="Endpoint Cloudflare R2"
                name="r2Endpoint"
                defaultValue={r2Endpoint}
                placeholder="https://<account-id>.r2.cloudflarestorage.com"
                required={activeProvider === "CLOUDFLARE_R2"}
                hint="Được cung cấp trong trang tổng quan Cloudflare R2 Console."
              />
            </div>
            <TextField
              id="r2-region"
              label="Region"
              name="r2Region"
              defaultValue={r2Region}
              placeholder="auto"
              required={activeProvider === "CLOUDFLARE_R2"}
            />
            <TextField
              id="r2-maxUploadMb"
              label="Giới hạn tải lên tối đa (MB)"
              name="r2MaxUploadMb"
              type="number"
              defaultValue={r2MaxUploadMb}
              placeholder="500"
              hint="Kích thước tệp tải lên tối đa cho mỗi tài liệu (MB)."
            />
            <TextField
              id="r2-bucketPrivate"
              label="Bucket Private (Tài liệu tải về)"
              name="r2BucketPrivate"
              defaultValue={r2BucketPrivate}
              placeholder="gieochu-private"
              required={activeProvider === "CLOUDFLARE_R2"}
            />
            <TextField
              id="r2-bucketPublic"
              label="Bucket Public (Ảnh bìa, tài nguyên)"
              name="r2BucketPublic"
              defaultValue={r2BucketPublic}
              placeholder="gieochu-public"
              required={activeProvider === "CLOUDFLARE_R2"}
            />
            <div className="md:col-span-2">
              <TextField
                id="r2-publicBaseUrl"
                label="Public Base URL của Bucket Public"
                name="r2PublicBaseUrl"
                defaultValue={r2PublicBaseUrl}
                placeholder="https://pub-xxxx.r2.dev"
                hint="URL công khai truy cập ảnh bìa hoặc domain tùy chỉnh gắn với bucket public."
              />
            </div>
            <TextField
              id="r2-accessKeyId"
              label="Access Key ID"
              name="r2AccessKeyId"
              type="password"
              placeholder={r2MaskedAccessKey ? `Hiện tại: ${r2MaskedAccessKey} (để trống nếu giữ nguyên)` : "Nhập Access Key ID"}
            />
            <TextField
              id="r2-secretAccessKey"
              label="Secret Access Key"
              name="r2SecretAccessKey"
              type="password"
              placeholder={r2MaskedSecretKey ? `Hiện tại: ${r2MaskedSecretKey} (để trống nếu giữ nguyên)` : "Nhập Secret Access Key"}
            />
          </div>
        </ConfigCard>
      </div>

      {/* 4. Panel Form MinIO */}
      <div className={activeTab === "MINIO" ? "block" : "hidden"}>
        <ConfigCard
          icon={<IconServer className="h-5 w-5" />}
          title="MinIO Object Storage (Self-hosted)"
          badges={
            <>
              {activeProvider === "MINIO" ? (
                <Badge tone="info">Nền tảng chính</Badge>
              ) : (
                <Badge tone="neutral">Kênh phụ</Badge>
              )}
              <Badge tone={initial.isEnabled ? "success" : "neutral"}>
                {initial.isEnabled ? "Đang bật" : "Đang tắt"}
              </Badge>
            </>
          }
          description="Hạ tầng lưu trữ tương thích S3 tự host trên VPS hoặc Private Cluster. Hỗ trợ Dedicated Bucket cho từng gian hàng (ADR-038)."
          footer={
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                MinIO sử dụng chuẩn cổng 9000 (S3 API). Các bucket riêng của gian hàng sẽ được tự động gắn tiền tố (prefix) cấu hình dưới đây.
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              id="minio-host"
              label="Host / IP Máy chủ MinIO"
              name="minioHost"
              defaultValue={minioHost}
              placeholder="192.168.1.100 hoặc s3.internal.domain"
              required={activeProvider === "MINIO"}
              hint="Địa chỉ IP hoặc tên miền máy chủ chạy MinIO server."
            />
            <TextField
              id="minio-port"
              label="Port (Cổng dịch vụ API)"
              name="minioPort"
              type="number"
              defaultValue={minioPort}
              placeholder="9000"
              required={activeProvider === "MINIO"}
              hint="Cổng S3 API của MinIO (mặc định 9000)."
            />

            <div className="md:col-span-2 rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900 block">Kích hoạt kết nối bảo mật SSL / TLS</span>
                <span className="text-xs text-gray-500 block">
                  Bật khi MinIO được bọc qua HTTPS (Nginx/Traefik reverse proxy hoặc chứng chỉ SSL hợp lệ).
                </span>
              </div>
              <input type="hidden" name="minioUseSSL" value={minioUseSsl ? "on" : "off"} />
              <button
                type="button"
                onClick={() => setMinioUseSsl((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  minioUseSsl ? "bg-[#0F3B82]" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={minioUseSsl}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    minioUseSsl ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <TextField
              id="minio-region"
              label="Vùng lưu trữ (Region)"
              name="minioRegion"
              defaultValue={minioRegion}
              placeholder="us-east-1"
            />
            <TextField
              id="minio-bucketPrefix"
              label="Tiền tố Bucket gian hàng (Bucket Prefix)"
              name="minioBucketPrefix"
              defaultValue={minioBucketPrefix}
              placeholder="gc-"
              maxLength={20}
              pattern="[a-z0-9][a-z0-9\-]{0,19}"
              title="Chữ thường, số, dấu gạch ngang; bắt đầu bằng chữ/số; tối đa 20 ký tự"
              hint="Tối đa 20 ký tự, chỉ chữ thường/số/dấu gạch ngang. Bucket gian hàng có dạng gc-k3j9x0a2m7qd (ADR-038)."
            />
            <TextField
              id="minio-maxUploadMb"
              label="Giới hạn tải lên tối đa (MB)"
              name="minioMaxUploadMb"
              type="number"
              defaultValue={minioMaxUploadMb}
              placeholder="500"
            />
            <TextField
              id="minio-publicBaseUrl"
              label="URL Công khai / CDN (Tùy chọn)"
              name="minioPublicBaseUrl"
              defaultValue={minioPublicBaseUrl}
              placeholder="https://cdn.yourdomain.com hoặc để trống"
              hint="URL để khách tải file hoặc xem ảnh công khai."
            />
            <TextField
              id="minio-accessKeyId"
              label="Root User / Access Key ID"
              name="minioAccessKeyId"
              type="password"
              placeholder={minioMaskedAccessKey ? `Hiện tại: ${minioMaskedAccessKey} (để trống nếu giữ nguyên)` : "minioadmin"}
            />
            <TextField
              id="minio-secretAccessKey"
              label="Root Password / Secret Key"
              name="minioSecretAccessKey"
              type="password"
              placeholder={minioMaskedSecretKey ? `Hiện tại: ${minioMaskedSecretKey} (để trống nếu giữ nguyên)` : "Mật khẩu MinIO"}
            />
          </div>
        </ConfigCard>
      </div>

      {/* Thông báo kết quả lưu form */}
      <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu cấu hình lưu trữ thành công." : undefined)} />

      {/* Thanh nút thao tác */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton loading={isPending}>
            {isPending ? "Đang lưu cấu hình..." : "Lưu cấu hình lưu trữ"}
          </PrimaryButton>
          <GhostButton
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const formData = formRef.current ? new FormData(formRef.current) : new FormData();
                formData.set("testingProvider", activeTab);
                const result = await testStorageConnectionAction(formData);
                setTestResult(result.testResult ?? null);
              })
            }
          >
            {isTesting ? "Đang kiểm tra kết nối..." : `Kiểm tra kết nối (${activeTab === "MINIO" ? "MinIO" : "Cloudflare R2"})`}
          </GhostButton>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <IconCheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Hỗ trợ kiến trúc S3 Dedicated Bucket & Dual-Provider (ADR-038)</span>
        </div>
      </div>

      {/* Thông báo kết quả kiểm tra kết nối */}
      {testResult ? (
        <FormBanner
          ok={testResult.ok}
          message={testResult.ok ? testResult.message ?? "Kết nối S3 thành công!" : (testResult.message ?? "Kết nối S3 thất bại.")}
        />
      ) : null}
    </form>
  );
}
