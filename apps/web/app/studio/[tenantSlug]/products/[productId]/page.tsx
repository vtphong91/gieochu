import { notFound } from "next/navigation";
import { AppError, EXTERNAL_DOCUMENT_EXACT_HOSTS, EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getProductEditorData } from "../../../../../lib/product";
import { AdminPageHeader, GhostLinkButton } from "../../../../admin/_ui/kit";
import { IconChevronLeft } from "../../../../admin/_ui/icons";
import { ProductEditor, type CreatedNotice } from "../_ui/product-editor";
import { PRODUCT_STATUS_LABEL } from "../_ui/editor-bits";

/** For a `datetime-local` input's defaultValue — wall-clock time in Asia/Ho_Chi_Minh, no timezone suffix. */
function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Allowlist host link ngoài (ADR-026 §3) — đọc ở server rồi truyền xuống client (không import `@gieochu/core` phía client). */
/** Tên trạng thái theo ngôn ngữ "chế độ hiển thị" (ADR-027 §1). */
const STATUS_SUBTITLE: Record<string, string> = { DRAFT: "Riêng tư", PUBLISHED: "Công khai", ARCHIVED: "Đã lưu trữ" };

const ALLOWED_HOSTS = [...EXTERNAL_DOCUMENT_EXACT_HOSTS, ...EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES.map((suffix) => `*${suffix}`)];

const CREATED_NOTICES: readonly CreatedNotice[] = ["draft", "published", "blocked"];

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; productId: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
}) {
  const { tenantSlug, productId } = await params;
  // ADR-027 §4: trang Tạo chuyển sang đây kèm `?created=` để báo kết quả lần lưu đầu (chỉ nhận giá trị đã biết).
  const { created } = await searchParams;
  const notice = CREATED_NOTICES.find((value) => value === created) ?? null;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/${productId}`);

  let data;
  try {
    data = await getProductEditorData(tenant.id, productId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }

  const { product } = data;

  // Trang "tạo/sửa" của Studio: vùng làm việc fluid theo sidebar (ADR-024); ProductEditor tự chặn khung ở 1440px
  // và căn giữa. Wrapper là <div> — studio/layout.tsx đã có <main> (tránh landmark main lồng nhau).
  return (
    <div className="px-5 pt-8 pb-12 lg:px-8">
      <ProductEditor
        mode="edit"
        tenantSlug={tenantSlug}
        header={
          <AdminPageHeader
            title={product.title}
            subtitle={`${STATUS_SUBTITLE[product.status] ?? PRODUCT_STATUS_LABEL[product.status] ?? product.status} · cập nhật ${formatVnDate(product.updatedAt)}`}
            action={
              <GhostLinkButton href={`/studio/${tenantSlug}/products`}>
                <IconChevronLeft className="h-4 w-4" /> Danh sách sản phẩm
              </GhostLinkButton>
            }
          />
        }
        categories={data.categories.map((c) => ({ id: c.id, name: c.name }))}
        allowedHosts={ALLOWED_HOSTS}
        product={{
          id: product.id,
          slug: product.slug,
          status: product.status,
          title: product.title,
          summary: product.summary ?? "",
          description: product.description ?? "",
          type: product.type,
          categoryId: product.categoryId,
          tags: product.tags,
          priceVnd: product.priceVnd,
          salePriceVnd: product.salePriceVnd?.toString() ?? "",
          saleStartsAt: toDatetimeLocal(product.saleStartsAt),
          saleEndsAt: toDatetimeLocal(product.saleEndsAt),
          downloadLimit: product.downloadLimit,
          coverImageUrl: product.coverImageUrl ?? "",
        }}
        currentCategory={data.category}
        files={data.files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          sizeBytes: f.sizeBytes,
          scanStatus: f.scanStatus,
          isPreview: f.isPreview,
          createdAtLabel: formatVnDate(f.createdAt),
        }))}
        links={data.links.map((l) => ({ id: l.id, label: l.label, url: l.url, host: hostOf(l.url), isAllowed: l.isAllowed }))}
        publish={{ allowed: data.publish.allowed, checklist: data.publish.checklist }}
        legacyCoverUrl={product.coverImageUrl ? null : product.coverUrl}
        notice={notice}
      />
    </div>
  );
}
