-- ADR-036 (2026-10-16): dọn job pg-boss tồn đọng trên DB dùng chung (ADR-034).
-- KHÔNG phải Prisma migration (schema pgboss không do Prisma quản lý, đây là dọn dữ liệu chạy 1 lần).
-- Chạy trong Neon Console → SQL Editor bằng role owner. Không chạy khi đang có integration test.
-- Bước 1 chạy trước, đối chiếu kỳ vọng; khác kỳ vọng → DỪNG, báo Quốc.

-- ── Bước 1: KIỂM (chỉ đọc) ─────────────────────────────────────────────
-- Kỳ vọng: payment.process test tổng 35 (18 created, 15 failed, 2 completed)
SELECT name, state, count(*) FROM pgboss.job
WHERE name = 'payment.process' AND data->>'providerEventId' LIKE 'evt\_m8test\_%' ESCAPE '\'
GROUP BY 1, 2;

-- Kỳ vọng: 0 (không job test nào thuộc tenant còn tồn tại)
SELECT count(*) FROM pgboss.job j
WHERE name = 'payment.process' AND data->>'providerEventId' LIKE 'evt\_m8test\_%' ESCAPE '\'
  AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = j.data->>'tenantId');

-- Kỳ vọng: order.sweep 89, subscription.sweep 6
SELECT name, count(*) FROM pgboss.job
WHERE name IN ('order.sweep', 'subscription.sweep') AND state = 'created'
GROUP BY 1;

-- ── Bước 2: XOÁ ──────────────────────────────────────────────────────
BEGIN;
DELETE FROM pgboss.job
WHERE name = 'payment.process' AND data->>'providerEventId' LIKE 'evt\_m8test\_%' ESCAPE '\';
DELETE FROM pgboss.job
WHERE name IN ('order.sweep', 'subscription.sweep') AND state = 'created';
DELETE FROM pgboss.schedule
WHERE name IN ('order.sweep', 'subscription.sweep');
COMMIT;
