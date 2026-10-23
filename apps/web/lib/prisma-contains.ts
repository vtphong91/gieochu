/**
 * Escape giá trị người dùng trước khi đưa vào Prisma `contains`/`startsWith`/`endsWith`. Prisma KHÔNG escape ký tự
 * wildcard của LIKE (đã kiểm thực tế ADR-046: `contains: "%"` khớp mọi dòng) → escape `\` trước, rồi `%`, `_`. Postgres
 * LIKE/ILIKE mặc định dùng `\` làm ký tự escape nên không cần mệnh đề `ESCAPE`.
 * (SQL thô `$queryRaw` dùng `escapeLikePattern` ở `lib/shop.ts` kèm `ESCAPE '\'` tường minh.)
 */
export function escapeContainsValue(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
