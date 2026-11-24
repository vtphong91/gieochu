# Thanh toán tự động qua SePay: code đang chạy và cách dùng lại

> Cập nhật 2026-11-24. Tài liệu ghi lại **code đang chạy thành công trên production** của SEO Management Tool (Next.js 15 App Router + Supabase), để chép sang hệ thống khác.
> Mỗi khối code đều ghi đường dẫn file gốc. Phần `…` là chỗ lược bớt logic riêng của hệ thống này.
> Khi dùng lại, đọc **[mục 13](#13-khi-dùng-lại-những-chỗ-phải-sửa)** trước: code gốc có vài điểm phải sửa trước khi chép sang hệ thống khác.
> Hướng dẫn vận hành riêng của hệ thống gốc (biến môi trường Vercel, domain thật): `docs/SEPAY_INTEGRATION_SETUP.md`, chỉ dành cho super admin.

Mục lục
1. [SePay làm gì](#1-sepay-làm-gì)
2. [Luồng tổng thể](#2-luồng-tổng-thể)
3. [Bản đồ file](#3-bản-đồ-file)
4. [Cơ sở dữ liệu](#4-cơ-sở-dữ-liệu)
5. [Kiểu dữ liệu và registry nhà cung cấp](#5-kiểu-dữ-liệu-và-registry-nhà-cung-cấp)
6. [Mã hoá cấu hình và trang admin](#6-mã-hoá-cấu-hình-và-trang-admin)
7. [Mã tham chiếu](#7-mã-tham-chiếu)
8. [Tạo đơn, QR và chờ xác nhận ở client](#8-tạo-đơn-qr-và-chờ-xác-nhận-ở-client)
9. [Webhook: xác nhận thanh toán thành công](#9-webhook-xác-nhận-thanh-toán-thành-công)
10. [Kích hoạt gói sau khi thanh toán](#10-kích-hoạt-gói-sau-khi-thanh-toán)
11. [Dự phòng: admin kiểm tra qua SePay API](#11-dự-phòng-admin-kiểm-tra-qua-sepay-api)
12. [Cấu hình SePay Dashboard và môi trường](#12-cấu-hình-sepay-dashboard-và-môi-trường)
13. [Khi dùng lại: những chỗ phải sửa](#13-khi-dùng-lại-những-chỗ-phải-sửa)
14. [Kiểm thử go-live và xử lý sự cố](#14-kiểm-thử-go-live-và-xử-lý-sự-cố)

---

## 1. SePay làm gì

SePay **đối soát chuyển khoản ngân hàng**. Nó theo dõi biến động số dư của tài khoản ngân hàng bạn kết nối, rồi gọi webhook về hệ thống của bạn khi có tiền vào. SePay cũng có API tra lịch sử giao dịch.

SePay không trừ tiền tự động và không thu định kỳ: khách tự chuyển khoản mỗi lần mua hoặc gia hạn. Việc khớp giao dịch với đơn hàng dựa hoàn toàn vào **mã tham chiếu trong nội dung chuyển khoản**.

## 2. Luồng tổng thể

```mermaid
sequenceDiagram
  participant U as Khách (UpgradeDialog)
  participant A as Server action
  participant DB as Supabase
  participant B as Ngân hàng
  participant SP as SePay
  participant W as /api/webhooks/sepay

  U->>A: createSubscriptionOrder(projectId, planId, 'sepay', months)
  A->>DB: INSERT subscription_orders (pending, reference_code = SEO + 8 số)
  A-->>U: order_id, reference_code, amount, payment_info (STK, ngân hàng)
  U->>U: Hiện QR qr.sepay.vn + thông tin chuyển khoản; poll trạng thái đơn mỗi 4s
  U->>B: Chuyển khoản, nội dung = reference_code
  B-->>SP: Biến động số dư
  SP->>W: POST, header Authorization: Apikey <key>
  W->>DB: INSERT payment_webhook_events (UNIQUE provider + id giao dịch)
  W->>DB: Tìm đơn pending theo code, kiểm số tiền
  W->>A: activateSubscriptionFromWebhook(orderId, txnId)
  A->>DB: upsert subscriptions, cập nhật projects.plan_limits, đơn → completed, audit, email
  W-->>SP: 200 {"success": true}
  U->>A: getSubscriptionOrderStatus → completed
  U->>U: Chuyển sang "Thanh toán thành công"
```

Nhánh dự phòng: nếu webhook không tới, khách bấm "Báo đã thanh toán" và đơn chuyển sang `pending_verification`. Super admin bấm "Kiểm tra SePay" để tra lịch sử giao dịch qua SePay API (mục 11), hoặc bấm kích hoạt tay.

## 3. Bản đồ file

| File | Vai trò |
| :-- | :-- |
| `lib/payment/types.ts` | Kiểu dữ liệu: `SepayConfig`, `SepayDisplayInfo`, `TransactionCheckResult` … |
| `lib/payment/registry.ts` | Danh sách nhà cung cấp, field cấu hình, field bắt buộc trước khi bật |
| `lib/payment/providers/sepay.ts` | Gọi SePay API: tra giao dịch, kiểm tra kết nối |
| `lib/actions/payment-providers.ts` | Server action admin: lưu cấu hình (mã hoá), bật/tắt, kiểm tra kết nối, kiểm tra đơn qua API; đọc thông tin hiển thị cho client |
| `lib/actions/subscriptions.ts` | Tạo đơn, báo đã chuyển, đọc trạng thái đơn, kích hoạt (admin + webhook) |
| `app/api/webhooks/sepay/route.ts` | Nhận webhook SePay |
| `components/subscription/upgrade-dialog.tsx` | Dialog nâng cấp: chọn tháng và phương thức, QR, poll trạng thái |
| `components/admin/payment-config-tab.tsx` | Trang admin cấu hình nhà cung cấp |
| `components/admin/subscription-manager-page.tsx` | Admin xem đơn, nút "Kiểm tra SePay", kích hoạt tay |
| `supabase/migrations/20260224_g2_payment_providers.sql`, `20260223_g2_subscriptions.sql`, `20260226_order_duration_months.sql`, `20260413_*`, `20260808_payment_webhook_events.sql`, `20261114c_complimentary_payment_method.sql` | Lược đồ |

## 4. Cơ sở dữ liệu

Lược đồ dưới đây là kết quả sau khi đã chạy hết các migration ở mục 3, gộp lại thành một file để tạo mới ở hệ thống khác.

```sql
-- 4.1 Cấu hình nhà cung cấp: secret nằm trong encrypted_config (mã hoá ở tầng ứng dụng)
CREATE TABLE IF NOT EXISTS payment_provider_configs (
  id               TEXT PRIMARY KEY,                -- 'sepay', 'manual_bank', 'manual_momo', …
  name             TEXT NOT NULL,
  is_enabled       BOOLEAN NOT NULL DEFAULT false,
  encrypted_config TEXT,                            -- "ivHex:cipherHex" của JSON cấu hình
  public_config    JSONB NOT NULL DEFAULT '{}',     -- cờ "<field>_configured": "true" để UI biết field đã lưu
  display_order    INTEGER NOT NULL DEFAULT 99,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE payment_provider_configs ENABLE ROW LEVEL SECURITY;  -- không policy: chỉ service role

-- 4.2 Đơn thanh toán
CREATE TABLE IF NOT EXISTS subscription_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = đơn cấp tài khoản
  plan_id          TEXT NOT NULL,
  amount           INTEGER NOT NULL,                -- VND = price_monthly × duration_months
  duration_months  INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'pending_verification', 'completed', 'cancelled')),
  payment_method   TEXT CHECK (payment_method IN (
                     'manual_bank','manual_momo','bank_transfer','momo','manual','sepay','stripe','vnpay','complimentary')),
  reference_code   TEXT UNIQUE NOT NULL,            -- SEO12345678 (mục 7)
  customer_txn_ref TEXT,                            -- mã giao dịch khách tự nhập khi báo đã chuyển
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),  -- người mua = chủ subscription
  confirmed_by     UUID REFERENCES auth.users(id),
  confirmed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_orders select" ON subscription_orders FOR SELECT USING (
  (project_id IS NOT NULL AND project_id IN (
     SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.status = 'active'))
  OR (project_id IS NULL AND created_by = auth.uid())
);
CREATE POLICY "subscription_orders insert" ON subscription_orders FOR INSERT WITH CHECK (
  (project_id IS NOT NULL AND project_id IN (
     SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.status = 'active'))
  OR (project_id IS NULL AND created_by = auth.uid())
);
-- ⚠️ Hệ thống gốc còn policy "subscription_orders update" cùng điều kiện như trên.
-- KHÔNG chép policy UPDATE đó sang hệ thống khác: xem mục 13, điểm 1.

-- 4.3 Sổ webhook: chống xử lý lặp + nhật ký đối soát
CREATE TABLE payment_webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  provider_event_id text NOT NULL,                  -- id giao dịch SePay
  event_type        text NOT NULL DEFAULT 'transfer_in',
  payload           jsonb NOT NULL,
  order_id          uuid REFERENCES subscription_orders(id),
  processing_status text NOT NULL DEFAULT 'received',   -- ignored | insufficient_amount | failed | activated | error
  error_message     text,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  UNIQUE (provider, provider_event_id)
);
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;  -- không policy: chỉ service role
```

Bảng `subscriptions` (một dòng cho mỗi tài khoản, `UNIQUE (user_id)`) có các cột mà bước kích hoạt ghi vào: `user_id, project_id, plan_id, status, is_trial, trial_ends_at, trial_plan_id, cancel_at_period_end, scheduled_plan_id, current_period_start, current_period_end, payment_method, activated_by, reminder_7d_sent_at, reminder_2d_sent_at, expired_at, updated_at`.

Vòng đời đơn: `pending` → (khách báo đã chuyển) `pending_verification` → (webhook / admin) `completed`. Đơn `pending` hoặc `pending_verification` có thể chuyển sang `cancelled`.

## 5. Kiểu dữ liệu và registry nhà cung cấp

```ts
// lib/payment/types.ts (trích)
export interface SepayConfig {
  api_token: string               // Bearer token cho SePay API
  account_number: string          // số tài khoản ngân hàng đang theo dõi
  webhook_api_key?: string        // key SePay gửi trong header Authorization khi gọi webhook
  payment_content_prefix?: string // từ khoá bắt buộc đầu nội dung CK (vd "SEVQR" cho VietinBank)
}

export interface TransactionCheckResult {
  found: boolean
  transaction_id?: string
  amount?: number
  transaction_date?: string
  transaction_content?: string
  reference_number?: string
}

export interface SepayDisplayInfo {          // trả cho client để dựng QR + hiển thị
  id: 'sepay'
  label: string
  group: 'automatic'
  account_number: string
  bank_short_name: string                    // vd "Vietcombank", "MBBank" (tên trong hệ thống VietQR)
  account_name: string
  bank_name?: string
  payment_content_prefix?: string
}

export interface ProviderMetadata {
  id: string
  name: string
  description: string
  group: 'manual' | 'automatic'
  badge?: string
  comingSoon?: boolean
  configFields?: Array<{ key: string; label: string; placeholder?: string; type: 'text' | 'password'; hint?: string }>
  requiredForActivation?: string[]           // field phải lưu rồi mới cho bật
}
```

```ts
// lib/payment/registry.ts (mục SePay)
{
  id: 'sepay',
  name: 'SePay',
  description: 'Tự động xác nhận thanh toán qua SePay Webhook (real-time) + API polling (fallback).',
  group: 'automatic',
  requiredForActivation: ['api_token', 'account_number'],
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', placeholder: 'Lấy từ SePay Dashboard → API Keys' },
    { key: 'account_number', label: 'Số tài khoản ngân hàng', type: 'password',
      hint: 'Phải trùng với tài khoản ngân hàng được kết nối trên SePay' },
    { key: 'bank_short_name', label: 'Tên ngân hàng (viết tắt)', type: 'password',
      hint: 'Dùng để tạo mã QR — phải khớp với tên trong hệ thống VietQR' },
    { key: 'account_name', label: 'Tên chủ tài khoản', type: 'password' },
    { key: 'webhook_api_key', label: 'Webhook API Key', type: 'password',
      hint: 'Để trống nếu chưa cấu hình webhook — SePay sẽ dùng API polling làm fallback' },
    { key: 'payment_content_prefix', label: 'Tiền tố nội dung chuyển khoản (nếu ngân hàng yêu cầu)', type: 'password',
      hint: 'Nếu điền, từ khoá này THAY THẾ "SEO" làm tiền tố mã tham chiếu (vd SEVQR12345678)' },
  ],
},
```

## 6. Mã hoá cấu hình và trang admin

Mọi field cấu hình được gộp thành một JSON rồi mã hoá AES-256-CBC bằng secret riêng của thanh toán, `PAYMENT_CONFIG_ENCRYPTION_SECRET`. Secret này không dùng chung với secret mã hoá API key AI. Secret được kiểm **lười** (chỉ khi gọi tới), vì throw ở top-level module làm vỡ `next build`.

```ts
// lib/actions/payment-providers.ts
const ALGORITHM = 'aes-256-cbc'

function getEncryptionKey(): string {
  const key = process.env.PAYMENT_CONFIG_ENCRYPTION_SECRET
  if (!key) throw new Error('PAYMENT_CONFIG_ENCRYPTION_SECRET is required for payment provider encryption')
  return key
}

function encryptConfig(value: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(getEncryptionKey().padEnd(32, '0').slice(0, 32)), iv)
  let encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decryptConfig(encrypted: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 2) throw new Error('Invalid encrypted format')
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(getEncryptionKey().padEnd(32, '0').slice(0, 32)), iv)
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

async function requireSuperAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!(await isSuperAdmin(user.id))) return { error: 'Super admin only' }
  return { userId: user.id }
}
```

**Lưu cấu hình theo kiểu gộp.** Admin chỉ gửi các field vừa sửa. Server giải mã cấu hình cũ, gộp field mới lên trên rồi mã hoá lại. Nhờ vậy lưu một field không xoá các secret đã lưu. `public_config` chỉ giữ cờ `<field>_configured`, không giữ giá trị.

```ts
// lib/actions/payment-providers.ts
export async function upsertPaymentProvider(
  id: string,
  updates: { is_enabled?: boolean; encrypted_fields?: Record<string, string>; public_fields?: Record<string, string> }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await requireSuperAdmin()
    if ('error' in auth) return { success: false, error: auth.error }

    const providerMeta = PROVIDER_REGISTRY.find((p) => p.id === id)
    const payload: Record<string, unknown> = { id, name: providerMeta?.name ?? id, updated_at: new Date().toISOString() }
    if (updates.is_enabled !== undefined) payload.is_enabled = updates.is_enabled

    const publicUpdates: Record<string, string> = {}
    const admin = createAdminClient()

    if (updates.encrypted_fields && Object.keys(updates.encrypted_fields).length > 0) {
      let existingDecrypted: Record<string, string> = {}
      const { data: existingRow } = await admin
        .from('payment_provider_configs').select('encrypted_config').eq('id', id).maybeSingle()
      if (existingRow?.encrypted_config) {
        try { existingDecrypted = JSON.parse(decryptConfig(existingRow.encrypted_config as string)) } catch { /* bắt đầu lại nếu hỏng */ }
      }
      const merged = { ...existingDecrypted, ...updates.encrypted_fields }
      payload.encrypted_config = encryptConfig(JSON.stringify(merged))
      for (const key of Object.keys(updates.encrypted_fields)) publicUpdates[`${key}_configured`] = 'true'
    }
    if (updates.public_fields) Object.assign(publicUpdates, updates.public_fields)

    const { data: existing } = await admin
      .from('payment_provider_configs').select('public_config').eq('id', id).maybeSingle()
    if (Object.keys(publicUpdates).length > 0) {
      payload.public_config = { ...((existing?.public_config as Record<string, string>) ?? {}), ...publicUpdates }
    }

    const { error } = await admin.from('payment_provider_configs').upsert(payload, { onConflict: 'id' })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lưu cấu hình thất bại' }
  }
}
```

**Chặn bật khi thiếu field bắt buộc.** Hàm đọc `requiredForActivation` trong registry và đối chiếu với các cờ `_configured`:

```ts
// lib/actions/payment-providers.ts — togglePaymentProvider (trích)
if (enabled && providerMeta?.requiredForActivation?.length) {
  const { data: row } = await admin.from('payment_provider_configs').select('public_config').eq('id', id).maybeSingle()
  const publicConfig = (row?.public_config as Record<string, string>) ?? {}
  const missing = providerMeta.requiredForActivation.filter((key) => publicConfig[`${key}_configured`] !== 'true')
  if (missing.length > 0) {
    const labels = missing.map((k) => providerMeta.configFields?.find((f) => f.key === k)?.label ?? k).join(', ')
    return { success: false, error: `Cần cấu hình đầy đủ trước khi bật: ${labels}` }
  }
}
// … upsert { id, name, is_enabled: enabled, updated_at }
```

**Thông tin hiển thị cho client.** Hàm chỉ trả các field cần cho QR, không bao giờ trả token hay webhook key:

```ts
// lib/actions/payment-providers.ts
export async function getEnabledSepayInfo(): Promise<{ success: boolean; sepay?: SepayDisplayInfo; error?: string }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('payment_provider_configs').select('id, is_enabled, encrypted_config').eq('id', 'sepay').maybeSingle()
    if (error) return { success: false, error: error.message }
    if (!data || !data.is_enabled || !data.encrypted_config) return { success: true }

    let cfg: Record<string, string> = {}
    try { cfg = JSON.parse(decryptConfig(data.encrypted_config as string)) } catch { return { success: true } } // hỏng → coi như tắt

    return {
      success: true,
      sepay: {
        id: 'sepay',
        label: 'SePay — Xác nhận tự động',
        group: 'automatic',
        account_number: cfg.account_number || '',
        bank_short_name: cfg.bank_short_name || '',
        account_name: cfg.account_name || '',
        bank_name: cfg.bank_name || cfg.bank_short_name || '',
        payment_content_prefix: cfg.payment_content_prefix || '',
      },
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Không thể tải thông tin SePay' }
  }
}
```

Nút "Kiểm tra kết nối" (`testSepayConnectionAction`) chỉ cho super admin. Hàm giải mã cấu hình rồi gọi `testSepayConnection(api_token, account_number)` ở mục 11. Nút này **chỉ kiểm API token**, không kiểm được webhook. Ô Webhook API Key có nút "Tạo key ngẫu nhiên" và tự sao chép key vào clipboard. Sau khi lưu, key không hiển thị lại.

## 7. Mã tham chiếu

```ts
// lib/actions/subscriptions.ts
function generateReferenceCode(prefix: string = 'SEO'): string {
  // SePay "Cấu trúc mã thanh toán" chỉ nhận diện hậu tố THUẦN SỐ với độ dài cố định — không được
  // lẫn chữ cái hay dấu gạch ngang, nếu không SePay sẽ không trích được payment code và không gọi webhook.
  // `prefix` mặc định "SEO", có thể ghi đè bằng từ khoá ngân hàng yêu cầu (vd "SEVQR" cho VietinBank) —
  // dùng LUÔN từ khoá đó làm tiền tố thay vì ghép thêm "SEO", để chỉ cần 1 mẫu "Cấu trúc mã thanh toán".
  const digits = Math.floor(10_000_000 + Math.random() * 90_000_000).toString()
  return `${prefix}${digits}`
}
```

Ba quy tắc đã kiểm chứng khi chạy thật:
1. **Tiền tố chữ + đúng 8 chữ số.** Mã cũ dạng `SEO-ABC123-PRO` (có chữ, có gạch ngang) làm SePay báo "Xác thực tự động: Không thực hiện" và không gọi webhook.
2. **Từ khoá bắt buộc của ngân hàng thay thế tiền tố, không ghép thêm.** Ô "Tiền tố" trên SePay giới hạn 2–5 chữ cái, nên `SEVQR` + `SEO` không gộp được thành một tiền tố.
3. Trên SePay chỉ giữ **một** mẫu "Cấu trúc mã thanh toán" khớp tiền tố đang dùng. Hai mẫu cạnh tranh nhau sẽ gây nhiễu nhận diện.

Đổi định dạng mã trong code thì phải đổi đồng bộ cấu hình trên SePay. Nếu không, webhook ngừng ngay mà phía bạn không có lỗi nào.

## 8. Tạo đơn, QR và chờ xác nhận ở client

**Tạo đơn.** Server tính giá từ bảng gói. Nếu đã có đơn đang chờ cùng gói, cùng số tháng và cùng phương thức, server trả lại đơn cũ thay vì tạo đơn mới (chống bấm hai lần).

```ts
// lib/actions/subscriptions.ts
export async function createSubscriptionOrder(
  projectId: string | null,
  planId: string,
  paymentMethod: 'manual_bank' | 'manual_momo' | 'sepay',
  durationMonths: number = 1
): Promise<{ success: boolean; order_id?: string; reference_code?: string; amount?: number; payment_info?: AnyProviderDisplay; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const plan = await getPlanDefinitionFromDB(planId)              // hàm của hệ thống: giá theo plan
  if (plan.price_monthly <= 0) return { success: false, error: 'Không thể tạo đơn hàng cho gói này' }

  const months = Math.max(1, Math.min(24, durationMonths))
  const totalAmount = plan.price_monthly * months

  const paymentInfo: AnyProviderDisplay | undefined = paymentMethod === 'sepay'
    ? (await getEnabledSepayInfo()).sepay
    : (await getManualProviderInfo(paymentMethod)) ?? undefined

  // Dedup: đơn đang chờ cùng plan + số tháng + phương thức → trả đơn cũ
  const { data: existingOrder } = await supabase
    .from('subscription_orders')
    .select('id, reference_code, amount')
    .eq('created_by', user.id)
    .eq('plan_id', planId)
    .eq('duration_months', months)
    .eq('payment_method', paymentMethod)
    .in('status', ['pending', 'pending_verification'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingOrder) {
    return { success: true, order_id: existingOrder.id, reference_code: existingOrder.reference_code, amount: existingOrder.amount, payment_info: paymentInfo }
  }

  const sepayContentPrefix = paymentMethod === 'sepay'
    ? (paymentInfo as SepayDisplayInfo | undefined)?.payment_content_prefix
    : undefined
  const referenceCode = generateReferenceCode(sepayContentPrefix || undefined)

  const { data: order, error } = await supabase
    .from('subscription_orders')
    .insert({
      project_id: projectId || null,
      plan_id: planId,
      amount: totalAmount,
      duration_months: months,
      status: 'pending',
      payment_method: paymentMethod,
      reference_code: referenceCode,
      created_by: user.id,
    })
    .select('id, reference_code, amount, duration_months')
    .single()
  if (error) return { success: false, error: error.message }

  return { success: true, order_id: order.id, reference_code: order.reference_code, amount: order.amount, payment_info: paymentInfo }
}
```

**Đọc trạng thái đơn.** Client gọi hàm này để poll:

```ts
// lib/actions/subscriptions.ts
export async function getSubscriptionOrderStatus(orderId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const { data, error } = await supabase
    .from('subscription_orders').select('status').eq('id', orderId).eq('created_by', user.id).maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Order not found' }
  return { success: true, status: data.status }
}
```

**Khách báo đã chuyển.** Đơn chuyển `pending` → `pending_verification`, kèm mã giao dịch ngân hàng khách tự nhập (không bắt buộc). Bước này **không kích hoạt** gói, chỉ giúp admin lọc đơn cần xử lý:

```ts
// lib/actions/subscriptions.ts — confirmPaymentSent (trích)
if (order.status !== 'pending') return { success: false, error: 'Đơn hàng không ở trạng thái chờ xác nhận' }
await supabase.from('subscription_orders').update({
  status: 'pending_verification',
  customer_txn_ref: customerTxnRef || null,
  notes: notes || null,
  updated_at: new Date().toISOString(),
}).eq('id', orderId)
```

**Client: QR và poll mỗi 4 giây.** Webhook xác nhận đơn mà không cần khách bấm gì, nên dialog tự chuyển sang "Thanh toán thành công" ngay khi đơn thành `completed`:

```tsx
// components/subscription/upgrade-dialog.tsx (trích)
const ORDER_POLL_INTERVAL_MS = 4000
const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

const stopOrderPolling = useCallback(() => {
  if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
}, [])

useEffect(() => {
  if (step !== 'sepay_qr' || !orderId) return
  const poll = async () => {
    const res = await getSubscriptionOrderStatus(orderId)
    if (res.success && res.status === 'completed') {
      stopOrderPolling()
      setAutoCompleted(true)
      setStep('done')
    }
  }
  poll()
  pollIntervalRef.current = setInterval(poll, ORDER_POLL_INTERVAL_MS)
  return stopOrderPolling   // dừng khi đóng dialog / đổi bước
}, [step, orderId, stopOrderPolling])
```

```tsx
// Ảnh QR VietQR do SePay dựng sẵn (không cần thư viện QR)
<img
  src={`https://qr.sepay.vn/img?acc=${encodeURIComponent(sepayInfo.account_number)}&bank=${encodeURIComponent(sepayInfo.bank_short_name)}&amount=${totalAmount}&des=${encodeURIComponent(referenceCode)}&template=compact`}
  alt="QR Code thanh toán SePay"
  width={220}
  height={220}
  onError={(e) => { e.currentTarget.style.display = 'none' /* hiện khối "Không tải được QR Code" */ }}
/>
```

Dưới QR luôn có các ô sao chép: Ngân hàng, Số tài khoản, Tên chủ tài khoản, **Nội dung chuyển khoản (bắt buộc)** = `referenceCode`, Số tiền. Có thêm dòng hướng dẫn: "Nếu chưa thấy kích hoạt sau 5 phút, nhấn 'Báo đã thanh toán' để admin xử lý thủ công", cùng hai nút "Thanh toán sau" và "Báo đã thanh toán".

## 9. Webhook: xác nhận thanh toán thành công

Toàn bộ route đang chạy:

```ts
// app/api/webhooks/sepay/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activateSubscriptionFromWebhook } from '@/lib/actions/subscriptions'
import type { SepayConfig } from '@/lib/payment/types'

export const dynamic = 'force-dynamic'

interface SepayWebhookPayload {
  id: number                    // SePay transaction ID
  gateway: string               // Ngân hàng
  transactionDate: string       // "2024-01-15 14:30:00"
  accountNumber: string         // Số tài khoản nhận
  subAccount: string | null
  transferType: 'in' | 'out'
  transferAmount: number        // VND
  accumulated: number
  code: string | null           // Mã thanh toán SePay đã trích từ nội dung CK
  content: string               // Nội dung chuyển khoản đầy đủ
  referenceCode: string         // Mã tham chiếu ngân hàng (khác mã đơn)
  description: string
}

// decryptConfig: giống mục 6 (cùng PAYMENT_CONFIG_ENCRYPTION_SECRET)

async function getSepayWebhookApiKey(): Promise<string | null> {
  if (process.env.SEPAY_WEBHOOK_API_KEY) return process.env.SEPAY_WEBHOOK_API_KEY   // env ghi đè DB
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('payment_provider_configs').select('encrypted_config').eq('id', 'sepay').maybeSingle()
    if (data?.encrypted_config) {
      const cfg = JSON.parse(decryptConfig(data.encrypted_config)) as SepayConfig
      return cfg.webhook_api_key || null
    }
  } catch { /* fall through */ }
  return null
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const webhookApiKey = await getSepayWebhookApiKey()
  if (!webhookApiKey) return false
  return authHeader === `Apikey ${webhookApiKey}`
}

export async function POST(request: NextRequest) {
  // 1. Xác thực nguồn gọi
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse payload
  let payload: SepayWebhookPayload
  try { payload = await request.json() } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  // 3. Chỉ xử lý tiền vào
  if (payload.transferType !== 'in') {
    return NextResponse.json({ success: true, message: 'Ignored: outgoing transfer' })
  }

  const admin = createAdminClient()

  // 3.5. Chống lặp: ghi sổ TRƯỚC khi xử lý. SePay gửi lại cùng id → đụng UNIQUE → bỏ qua.
  const { data: ledgerRow, error: ledgerError } = await admin
    .from('payment_webhook_events')
    .insert({ provider: 'sepay', provider_event_id: String(payload.id), payload: payload as unknown as Record<string, unknown> })
    .select('id')
    .single()
  if (ledgerError) {
    if (ledgerError.code === '23505') {
      return NextResponse.json({ success: true, message: 'Duplicate webhook — already processed' })
    }
    console.error('[SePay Webhook] Failed to write webhook ledger:', ledgerError.message) // không chặn luồng thanh toán
  }
  const ledgerId = ledgerRow?.id as string | undefined

  async function finalizeLedger(status: string, orderId?: string, errorMessage?: string) {
    if (!ledgerId) return
    await admin.from('payment_webhook_events').update({
      processing_status: status,
      order_id: orderId ?? null,
      error_message: errorMessage ?? null,
      processed_at: new Date().toISOString(),
    }).eq('id', ledgerId)
  }

  // 4. Mã thanh toán SePay đã trích theo "Cấu trúc mã thanh toán"
  const code = payload.code?.trim().toUpperCase()
  if (!code) {
    await finalizeLedger('ignored', undefined, 'No payment code in content')
    return NextResponse.json({ success: true, message: 'No payment code in content' })
  }

  // 5. Đơn đang chờ khớp mã
  const { data: order, error: orderError } = await admin
    .from('subscription_orders')
    .select('id, project_id, amount, status, reference_code')
    .eq('reference_code', code)
    .in('status', ['pending', 'pending_verification'])
    .maybeSingle()
  if (orderError) {
    await finalizeLedger('error', undefined, orderError.message)
    return NextResponse.json({ success: true, message: 'DB lookup error — logged' })
  }
  if (!order) {
    await finalizeLedger('ignored', undefined, 'No matching order found')
    return NextResponse.json({ success: true, message: 'No matching order found' })
  }

  // 6. Số tiền: chỉ xác nhận khi chuyển đủ hoặc dư
  if (payload.transferAmount < order.amount) {
    await admin.from('subscription_orders').update({
      notes: `Cảnh báo: Khách chuyển thiếu tiền. Cần: ${order.amount} VND, nhận: ${payload.transferAmount} VND. SePay txn #${payload.id}`,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)
    await finalizeLedger('insufficient_amount', order.id)
    return NextResponse.json({ success: true, message: 'Insufficient amount — flagged for review' })
  }

  // 7. Kích hoạt
  const result = await activateSubscriptionFromWebhook(order.id, payload.id)
  if (!result.success) {
    await finalizeLedger('failed', order.id, result.error)
    return NextResponse.json({ success: true, message: `Activation failed: ${result.error}` })
  }

  await finalizeLedger('activated', order.id)
  return NextResponse.json({ success: true, message: 'Subscription activated' })
}
```

Quy ước phản hồi:
- Sai key thì trả **401**. JSON hỏng thì trả **400**.
- Mọi trường hợp còn lại, kể cả lỗi nghiệp vụ, đều trả **200 `{"success": true}`**. Lỗi nghiệp vụ (không có đơn, chuyển thiếu, kích hoạt lỗi) không tự hết khi SePay gửi lại, nên chỉ ghi sổ để admin xử lý.

SePay coi một lần gửi là thành công khi nhận HTTP 200/201 kèm body `{"success": true}`. Thời gian chờ phản hồi là 30 giây.

Sổ `payment_webhook_events` là nơi đối soát chính. Mỗi giao dịch có một dòng, `processing_status` là một trong `ignored`, `insufficient_amount`, `failed`, `activated` hoặc `error`, kèm `order_id` và `error_message`.

## 10. Kích hoạt gói sau khi thanh toán

Hàm chạy không có phiên đăng nhập (gọi từ webhook), chỉ dùng admin client. Subscription gắn với **tài khoản người mua**, không gắn với project.

```ts
// lib/actions/subscriptions.ts
export async function activateSubscriptionFromWebhook(
  orderId: string,
  sepayTransactionId?: string | number
): Promise<{ success: boolean; error?: string }> {
  const adminClient = createAdminClient()

  const { data: order } = await adminClient.from('subscription_orders').select('*').eq('id', orderId).maybeSingle()
  if (!order) return { success: false, error: 'Không tìm thấy đơn hàng' }
  const o = order as any
  if (!['pending', 'pending_verification'].includes(o.status)) {
    return { success: false, error: 'Đơn hàng không ở trạng thái hợp lệ' }
  }

  const plan = await getPlanDefinitionFromDB(o.plan_id)
  const now = new Date()
  const durationMonths = (o.duration_months as number) || 1

  // Gia hạn: đang có gói TRẢ PHÍ còn hạn → nối tiếp từ ngày hết hạn; trial / hết hạn / chưa có → tính từ hôm nay
  const { data: existing } = await adminClient
    .from('subscriptions').select('status, current_period_end, is_trial').eq('user_id', o.created_by).maybeSingle()
  const existingEnd = existing?.current_period_end ? new Date(existing.current_period_end) : null
  const isPaidRenewal = existing?.status === 'active' && !existing?.is_trial && existingEnd !== null && existingEnd > now
  const periodStart = isPaidRenewal ? existingEnd! : now
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + durationMonths)

  const { error: subError } = await adminClient.from('subscriptions').upsert({
    user_id: o.created_by,
    project_id: o.project_id,
    plan_id: o.plan_id,
    status: 'active',
    is_trial: false,
    trial_ends_at: null,
    trial_plan_id: null,
    cancel_at_period_end: false,
    scheduled_plan_id: null,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    payment_method: o.payment_method,
    activated_by: null,
    reminder_7d_sent_at: null,
    // ⚠️ bản admin (activateOrderCore) còn reset reminder_2d_sent_at: null — khi dùng lại hãy thêm (mục 13, điểm 4)
    expired_at: null,
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' })                     // cần UNIQUE (user_id)
  if (subError) return { success: false, error: subError.message }

  // Riêng hệ thống này: lần đầu trả phí → nâng vai trò người dùng; áp giới hạn gói cho project
  if (!isPaidRenewal) {
    const roleResult = await upgradeUserToAdmin(o.created_by)
    if (!roleResult.success) console.warn('[activateSubscriptionFromWebhook] Role upgrade failed (non-blocking):', roleResult.error)
  }
  if (o.project_id) {
    const { error: projectError } = await adminClient.from('projects').update({ plan_limits: plan.limits }).eq('id', o.project_id)
    if (projectError) return { success: false, error: projectError.message }
  }

  const { error: orderError } = await adminClient.from('subscription_orders').update({
    status: 'completed',
    confirmed_at: now.toISOString(),
    notes: sepayTransactionId ? `Auto-confirmed via SePay webhook (txn: ${sepayTransactionId})` : 'Auto-confirmed via SePay webhook',
    updated_at: now.toISOString(),
  }).eq('id', orderId)
  if (orderError) return { success: false, error: orderError.message }

  await logSubscriptionEvent({
    userId: o.created_by,
    projectId: o.project_id,
    eventType: 'paid_activate',
    oldPlanId: existing?.is_trial ? 'trial' : (existing?.status === 'active' ? o.plan_id : null),
    newPlanId: o.plan_id,
    metadata: {
      order_id: orderId, duration_months: durationMonths,
      period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(),
      is_renewal: isPaidRenewal, source: 'webhook', sepay_transaction_id: sepayTransactionId,
    },
  })

  // Email kích hoạt / gia hạn — không chặn: lỗi email không làm hỏng kích hoạt
  try {
    // … đọc email người mua (adminClient.auth.admin.getUserById) + tên project
    // … isPaidRenewal ? sendSubscriptionRenewedEmail(...) : sendSubscriptionActivatedEmail(...)
  } catch { /* non-blocking */ }

  return { success: true }
}
```

Kích hoạt tay của admin (`activateSubscription` → `activateOrderCore`) chạy cùng các bước trên. Khác biệt duy nhất: hàm admin kiểm `isSuperAdmin`, ghi `confirmed_by` và `activated_by` bằng id admin, và reset cả hai mốc nhắc gia hạn.

## 11. Dự phòng: admin kiểm tra qua SePay API

Dùng khi webhook không tới. Ví dụ: chưa cấu hình webhook, key lệch, hoặc mạng gặp sự cố.

```ts
// lib/payment/providers/sepay.ts
const SEPAY_API_BASE = 'https://my.sepay.vn/userapi'

export async function checkSepayTransaction(
  referenceCode: string,
  expectedAmount: number,
  apiToken: string,
  accountNumber: string
): Promise<TransactionCheckResult> {
  const url = new URL(`${SEPAY_API_BASE}/transactions/list`)
  url.searchParams.set('account_number', accountNumber)
  url.searchParams.set('limit', '100')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`SePay API error: ${response.status} ${response.statusText}`)

  const data: SepayListResponse = await response.json()
  if (!data.messages?.success) throw new Error(`SePay API returned error: ${data.error ?? 'Unknown error'}`)

  const ref = referenceCode.toUpperCase()
  const matched = data.transactions.find((tx) =>
    tx.transaction_content.toUpperCase().includes(ref) && parseInt(tx.amount_in, 10) >= expectedAmount
  )
  if (!matched) return { found: false }

  return {
    found: true,
    transaction_id: matched.id,
    amount: parseInt(matched.amount_in, 10),
    transaction_date: matched.transaction_date,
    transaction_content: matched.transaction_content,
    reference_number: matched.reference_number,
  }
}

/** "Kiểm tra kết nối": lấy 1 giao dịch để xác nhận token + số tài khoản hợp lệ */
export async function testSepayConnection(apiToken: string, accountNumber: string): Promise<{ success: boolean; message?: string }> {
  // … như trên với limit = 1; trả `Kết nối thành công — N giao dịch gần nhất` hoặc thông báo lỗi
}
```

```ts
// lib/actions/payment-providers.ts — checkSepayForOrder (super admin, nút "Kiểm tra SePay" trên đơn)
export async function checkSepayForOrder(orderId: string) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const admin = createAdminClient()

  const { data: order } = await admin.from('subscription_orders').select('id, reference_code, amount, status').eq('id', orderId).maybeSingle()
  if (!order) return { success: false, error: 'Không tìm thấy đơn hàng' }
  if (!['pending', 'pending_verification'].includes(order.status)) return { success: false, error: 'Đơn hàng không ở trạng thái cần xác nhận' }

  const { data: row } = await admin.from('payment_provider_configs').select('encrypted_config, is_enabled').eq('id', 'sepay').maybeSingle()
  if (!row?.is_enabled) return { success: false, error: 'SePay chưa được kích hoạt' }
  if (!row?.encrypted_config) return { success: false, error: 'Chưa cấu hình SePay' }
  const config = JSON.parse(decryptConfig(row.encrypted_config)) as SepayConfig

  const result = await checkSepayTransaction(order.reference_code, order.amount, config.api_token, config.account_number)
  if (!result.found) return { success: true, found: false }

  const activateResult = await activateSubscription(orderId)   // cùng đường kích hoạt tay của admin
  if (!activateResult.success) return { success: false, error: `Tìm thấy GD nhưng kích hoạt thất bại: ${activateResult.error}` }
  return { success: true, found: true, transaction_content: result.transaction_content }
}
```

Lưu ý khi đọc dữ liệu từ API:
- Số tiền trả về dạng chuỗi có phần thập phân (ví dụ `"19689000.00"`). `parseInt` vẫn đúng với VND vì phần thập phân luôn là `.00`.
- API cho phép `limit` tối đa 5000. Code dùng 100 giao dịch gần nhất, đủ cho đơn vừa tạo.

## 12. Cấu hình SePay Dashboard và môi trường

**Biến môi trường**

| Biến | Bắt buộc | Ghi chú |
| :-- | :-: | :-- |
| `PAYMENT_CONFIG_ENCRYPTION_SECRET` | ✔ | Chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -base64 32`). Đặt ở môi trường **Production** rồi redeploy. Đổi secret thì cấu hình cũ không giải mã được nữa, phải nhập lại |
| `SEPAY_WEBHOOK_API_KEY` | – | Ghi đè webhook key lưu trong DB (dùng khi cần xoay khoá khẩn cấp) |
| `NEXT_PUBLIC_APP_URL` | – | Dựng link trong email kích hoạt |

**Các bước trên SePay (my.sepay.vn)**
1. Kết nối tài khoản ngân hàng nhận tiền.
2. Mở trang chi tiết tài khoản ngân hàng và đọc banner "Quan trọng". Nếu ngân hàng bắt buộc từ khoá đầu nội dung (VietinBank: `SEVQR`), nhập từ khoá đó vào ô "Tiền tố nội dung chuyển khoản" trong trang admin.
3. **API Keys** → tạo token, nhập vào ô API Token.
4. **Công ty → Cấu hình chung → Cấu trúc mã thanh toán** → tạo **một** mẫu:
   - Tiền tố: `SEO`, hoặc từ khoá ngân hàng ở bước 2.
   - Hậu tố: **từ 8 đến 8** ký tự, **Là Số nguyên**.

   Xoá hoặc tắt các mẫu khác.
5. Trong trang admin, bấm "Tạo key ngẫu nhiên" ở ô Webhook API Key và lưu key lại.
6. **Webhooks** → thêm mới:
   - URL: `https://app.example.com/api/webhooks/sepay`
   - Phương thức: POST
   - Chứng thực: **Apikey**, giá trị là key ở bước 5
   - Sự kiện: tiền vào
7. Trong trang admin, điền đủ các field, **Lưu cấu hình**, rồi bật SePay. Hệ thống chặn bật nếu thiếu API Token hoặc Số tài khoản.
8. Bấm "Kiểm tra kết nối". Bước này chỉ kiểm token. Webhook kiểm bằng giao dịch thật ở mục 14.

## 13. Khi dùng lại: những chỗ phải sửa

Code trên chạy đúng cho luồng thanh toán bình thường. Khi chép sang hệ thống khác, cần sửa các điểm sau. Điểm 1 là bắt buộc.

1. **Không cho client UPDATE bảng đơn.** Hệ thống gốc có policy `"subscription_orders update"` cho chủ đơn và thành viên project sửa mọi cột. Webhook so số tiền chuyển với `amount` trong đơn, nên ai sửa được `amount` thì mua được gói với giá tuỳ ý. Cách sửa:
   - Bỏ policy UPDATE.
   - Chuyển `confirmPaymentSent` và `cancelSubscriptionOrder` sang admin client, sau khi đã kiểm `created_by = user.id` và trạng thái hợp lệ.
2. **Đặt `activateSubscriptionFromWebhook` trong module `server-only`**, không để trong file `'use server'`. Mọi export của file `'use server'` là endpoint gọi được từ client, mà hàm này không kiểm quyền.
3. **Kích hoạt nguyên tử.** Thay bước "đọc status rồi ghi" bằng một câu UPDATE có điều kiện, để webhook, nút "Kiểm tra SePay" và trường hợp khách chuyển hai lần không gia hạn gấp đôi:
   ```ts
   const { data: claimed } = await admin.from('subscription_orders')
     .update({ status: 'processing', updated_at: new Date().toISOString() })   // thêm 'processing' vào CHECK status
     .eq('id', orderId).in('status', ['pending', 'pending_verification'])
     .select('*').maybeSingle()
   if (!claimed) return { success: false, error: 'Đơn đã được xử lý' }
   ```
4. **Dùng chung một hàm kích hoạt** cho admin và webhook. Hai bản đang lệch nhau: bản webhook không reset `reminder_2d_sent_at`.
5. **Kiểm `payload.accountNumber`** đúng với tài khoản trong cấu hình. Một tài khoản SePay có thể nối nhiều tài khoản ngân hàng.
6. **So sánh key bằng `crypto.timingSafeEqual`** thay vì `===`.
7. **Mã hoá AES-256-GCM, khoá = SHA-256(secret)** thay cho CBC + `padEnd`. Có thêm auth tag, và secret ngắn không làm khoá yếu đi.
8. **Mã tham chiếu bằng `crypto.randomInt`**, và thử lại khi insert trùng `reference_code` (lỗi `23505`).

## 14. Kiểm thử go-live và xử lý sự cố

**Kiểm thử bằng giao dịch thật**
1. Tạo đơn SePay ở gói rẻ nhất, chuyển khoản đúng số tiền và đúng nội dung.
2. Mở chi tiết giao dịch trên SePay. Phải có **"Xác thực tự động: Thực hiện"** và **Webhooks ≥ 1**.
3. Kiểm phía hệ thống:
   - đơn chuyển `completed`;
   - dialog tự chuyển sang "Thanh toán thành công";
   - `payment_webhook_events` có dòng `activated`;
   - `subscriptions` đúng gói, đúng ngày hết hạn.
4. Chuyển thiếu tiền: đơn có ghi chú cảnh báo và không được kích hoạt.

**Xử lý sự cố**

| Triệu chứng | Nguyên nhân | Cách xử lý |
| :-- | :-- | :-- |
| Lưu cấu hình lỗi 500 | Thiếu `PAYMENT_CONFIG_ENCRYPTION_SECRET`, hoặc đặt sai môi trường | Đặt ở Production rồi redeploy |
| Webhook trả 401 | Key trên SePay khác key trong app, hoặc env `SEPAY_WEBHOOK_API_KEY` đang ghi đè | Tạo lại key, cập nhật cả hai nơi |
| SePay không thấy giao dịch dù tiền đã vào | Thiếu từ khoá bắt buộc của ngân hàng ở đầu nội dung | Mục 12 bước 2 |
| SePay thấy giao dịch nhưng "Xác thực tự động: Không thực hiện", 0 webhook | Mã không khớp "Cấu trúc mã thanh toán" (có chữ hoặc gạch ngang, sai độ dài, sai tiền tố, nhiều mẫu cạnh tranh) | Mục 7, mục 12 bước 4 |
| Sổ ghi `ignored` + "No matching order found" | Khách gõ sai mã, hoặc đơn đã huỷ hoặc đã xử lý | Admin đối chiếu rồi kích hoạt tay |
| Đơn ghi "Cảnh báo: Khách chuyển thiếu tiền" | Đúng thiết kế | Admin liên hệ khách, kích hoạt tay hoặc huỷ |
| Không bật được SePay | Chưa lưu API Token hoặc Số tài khoản | Lưu đủ hai field rồi bật |
| Đổi secret mã hoá xong mất cấu hình | Dữ liệu cũ mã hoá bằng khoá cũ | Nhập lại cấu hình |
