const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Đọc page/pageSize an toàn từ searchParams (server component) — mặc định trang 1, 20 dòng/trang. */
export function parsePagination(searchParams: { page?: string; pageSize?: string }): { page: number; pageSize: number; skip: number; take: number } {
  const allowedSizes = new Set(PAGE_SIZE_OPTIONS);
  const pageSize = allowedSizes.has(Number(searchParams.pageSize)) ? Number(searchParams.pageSize) : 20;
  const page = Math.max(1, Number(searchParams.page) || 1);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
