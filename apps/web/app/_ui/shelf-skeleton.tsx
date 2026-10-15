import { LINE, PAPER_ALT } from "./catalog-parts";

/** Khối xám giữ chỗ; nhấp nháy chỉ khi người dùng không bật giảm chuyển động. */
const BONE = "rounded-md motion-safe:animate-pulse";

function Bone({ className }: { className: string }) {
  return <div className={`${BONE} ${className}`} style={{ background: LINE }} />;
}

export interface ShelfSkeletonProps {
  /** Hình dạng giữ chỗ: kệ tài liệu (mặc định), lưới danh mục, kệ gian hàng, hero. */
  variant?: "products" | "categories" | "tenants" | "hero";
  /** Chữ cho trình đọc màn hình: "Đang tải {label}…". */
  label?: string;
  /** Số kệ xếp chồng (vd nhóm kệ sản phẩm). Mặc định 1. */
  shelves?: number;
  background?: "paper" | "alt";
}

function ShelfHeaderBones() {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div className="w-full max-w-[420px]">
        <Bone className="h-7 w-2/3" />
        <Bone className="mt-3 h-4 w-full" />
      </div>
      <Bone className="hidden h-11 w-40 rounded-full sm:block" />
    </div>
  );
}

function ProductBones() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`overflow-hidden rounded-2xl border bg-white ${i >= 4 ? "hidden lg:block" : ""}`} style={{ borderColor: LINE }}>
          <Bone className="aspect-[16/10] rounded-none" />
          <div className="p-3 sm:p-4">
            <Bone className="h-4 w-full" />
            <Bone className="mt-2 h-4 w-3/4" />
            <Bone className="mt-3 h-3 w-1/2" />
            <Bone className="mt-4 h-5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryBones() {
  return (
    <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-3 ${i >= 6 ? "hidden sm:flex" : ""}`} style={{ borderColor: LINE }}>
          <Bone className="h-12 w-12 rounded-xl" />
          <Bone className="h-3.5 w-3/4" />
          <Bone className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function TenantBones() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2.5 rounded-3xl border bg-white p-4 sm:p-[26px]" style={{ borderColor: LINE }}>
          <Bone className="h-16 w-16 rounded-full sm:h-[72px] sm:w-[72px]" />
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3.5 w-1/2" />
          <Bone className="mt-2 h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Fallback cho `<Suspense>` theo nhóm kệ Cửa hàng: giữ đúng kích thước lưới thật (tránh nhảy bố cục), `role="status"`
 * + chữ ẩn cho trình đọc màn hình; khối xám `aria-hidden`; `animate-pulse` chỉ khi `motion-safe`.
 */
export function ShelfSkeleton({ variant = "products", label = "nội dung", shelves = 1, background = "paper" }: ShelfSkeletonProps) {
  const bg = background === "alt" ? { background: PAPER_ALT } : undefined;

  if (variant === "hero") {
    return (
      <div role="status" className="py-10 sm:py-14 lg:py-20" style={{ background: PAPER_ALT }}>
        <span className="sr-only">Đang tải {label}…</span>
        <div aria-hidden="true" className="container-page flex flex-col gap-4">
          <Bone className="h-7 w-40 rounded-full" />
          <Bone className="h-10 w-full max-w-[560px]" />
          <Bone className="h-5 w-full max-w-[480px]" />
          <div className="h-[150px] w-full max-w-[640px] rounded-2xl bg-white sm:h-[92px]" />
        </div>
      </div>
    );
  }

  return (
    <div role="status">
      <span className="sr-only">Đang tải {label}…</span>
      <div aria-hidden="true">
        {Array.from({ length: Math.max(1, shelves) }).map((_, i) => (
          <div key={i} className="py-10 sm:py-14 lg:py-16" style={bg}>
            <div className="container-page">
              <ShelfHeaderBones />
              {variant === "categories" ? <CategoryBones /> : variant === "tenants" ? <TenantBones /> : <ProductBones />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
