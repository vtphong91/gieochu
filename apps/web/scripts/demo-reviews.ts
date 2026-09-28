/**
 * Dữ liệu DEMO cho DB dev — xem giao diện Đánh giá (M10a, ADR-029) và editor sản phẩm trên tenant `phongweb`.
 * KHÔNG dùng cho staging/production, KHÔNG phải seed chính (`packages/db/prisma/seed.ts`).
 *
 *   ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:seed    # dọn demo cũ rồi seed lại (idempotent)
 *   ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:clean   # xoá đúng và chỉ dữ liệu demo
 *   (PowerShell: $env:ALLOW_DEMO_SEED="1"; pnpm --filter @gieochu/db run demo:seed)
 *
 * Đặt ở apps/web (không phải packages/db) để đi qua đúng lib nghiệp vụ hiện có — createProduct/publishProduct
 * (canPublishProduct), markOrderPaid, upsertMyReview (RLS customer), replyToReview/hideReview (RLS tenant),
 * recomputeProductRatings (system_job) — cùng mẫu worker.ts. Không gửi email nào (không gọi createOrder /
 * confirmOrderManually vì 2 hàm đó gửi email đơn hàng cho khách + chủ tenant).
 *
 * Nhận diện dữ liệu demo bằng danh sách CỐ ĐỊNH: 5 email `demo+...@gieochu.test` (TLD .test dành riêng, không
 * thể là người thật), 3 slug sản phẩm `demo-...` trong tenant `phongweb`, 1 slug danh mục `demo-...` (chỉ tạo
 * khi DB chưa có danh mục active nào). Mọi đơn/entitlement/review/tenant_customers của 5 user demo là dữ liệu demo.
 */
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "@gieochu/auth";
import { getEnv } from "@gieochu/config";
import { calculateOrderPricing, computeOrderExpiresAt, computeRatingAverage, generateOrderCode, isCloudinaryImageUrl, productPath } from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { getPrismaClient, withCustomer, withSystemJob, withTenant, type ProductType, type Tx } from "@gieochu/db";
import { markOrderPaid } from "../lib/order";
import { addProductExternalLink, createProduct, publishProduct } from "../lib/product";
import { hideReview, recomputeProductRatings, replyToReview, upsertMyReview } from "../lib/review";
import { getSystemCloudinaryCloudName } from "../lib/system-cloudinary";

const TENANT_SLUG = "phongweb";
const DEMO_PASSWORD = "Demo@12345";
const DEMO_CATEGORY_SLUG = "demo-tai-lieu-mau";
const DEMO_NOTE = "Dữ liệu demo (scripts/demo-reviews.ts)";

type ProductKey = "free" | "sale" | "full";

interface DemoProductDef {
  key: ProductKey;
  slug: string;
  title: string;
  type: ProductType;
  summary: string;
  descriptionHtml: string;
  tags: string[];
  priceVnd: number;
  salePriceVnd: number | null;
  saleDays: number | null;
  linkLabel: string;
  linkUrl: string;
}

const DEMO_PRODUCTS: DemoProductDef[] = [
  {
    key: "free",
    slug: "demo-bo-de-kiem-tra-toan-6-hoc-ky-1",
    title: "Bộ đề kiểm tra Toán 6 – Học kỳ I",
    type: "EXAM",
    summary: "10 đề kiểm tra giữa kỳ và cuối kỳ I môn Toán 6, có đáp án và thang điểm chi tiết, bám sát chương trình mới.",
    descriptionHtml:
      "<h2>Bộ đề gồm những gì?</h2><ul><li>6 đề kiểm tra giữa học kỳ I</li><li>4 đề kiểm tra cuối học kỳ I</li><li>Đáp án, hướng dẫn chấm và ma trận đề cho từng đề</li></ul><p>Phù hợp để giáo viên tham khảo ra đề hoặc cho học sinh tự luyện ở nhà. File Word chỉnh sửa được.</p>",
    tags: ["toán 6", "đề kiểm tra", "học kỳ I"],
    priceVnd: 0,
    salePriceVnd: null,
    saleDays: null,
    linkLabel: "Bộ đề Toán 6 HK1 (Google Drive)",
    linkUrl: "https://drive.google.com/drive/folders/demo-toan-6-hk1",
  },
  {
    key: "sale",
    slug: "demo-slide-bai-giang-ngu-van-9",
    title: "Slide bài giảng Ngữ văn 9 – Trọn bộ học kỳ I",
    type: "SLIDE",
    summary: "Hơn 40 bài giảng PowerPoint Ngữ văn 9 thiết kế đẹp, có hoạt động khởi động, câu hỏi thảo luận và phiếu học tập.",
    descriptionHtml:
      "<h2>Điểm nổi bật</h2><p>Bộ slide được soạn theo tiến trình 4 bước: <strong>khởi động – hình thành kiến thức – luyện tập – vận dụng</strong>.</p><ul><li>Hơn 40 bài giảng, mỗi bài 20–30 trang chiếu</li><li>Kèm phiếu học tập in được</li><li>Hình ảnh, sơ đồ tư duy minh hoạ rõ ràng</li></ul><p><em>Giá ưu đãi trong 30 ngày.</em></p>",
    tags: ["ngữ văn 9", "slide", "powerpoint"],
    priceVnd: 149_000,
    salePriceVnd: 99_000,
    saleDays: 30,
    linkLabel: "Slide Ngữ văn 9 HK1 (Google Drive)",
    linkUrl: "https://drive.google.com/drive/folders/demo-ngu-van-9-slide",
  },
  {
    key: "full",
    slug: "demo-ebook-phuong-phap-day-hoc-tich-cuc",
    title: "Ebook: 25 phương pháp dạy học tích cực cho giáo viên THCS",
    type: "EBOOK",
    summary: "Cẩm nang 25 kỹ thuật dạy học tích cực, mỗi kỹ thuật có ví dụ tiết dạy thực tế và lưu ý khi tổ chức trên lớp.",
    descriptionHtml:
      "<h2>Nội dung chính</h2><ol><li>Nhóm kỹ thuật khởi động và tạo hứng thú</li><li>Nhóm kỹ thuật hợp tác: khăn trải bàn, mảnh ghép, phòng tranh…</li><li>Nhóm kỹ thuật đánh giá thường xuyên</li></ol><p>Ebook PDF 180 trang, trình bày dễ đọc trên điện thoại và máy tính bảng.</p>",
    tags: ["phương pháp dạy học", "ebook", "THCS"],
    priceVnd: 199_000,
    salePriceVnd: null,
    saleDays: null,
    linkLabel: "Ebook 25 phương pháp dạy học tích cực (PDF)",
    linkUrl: "https://drive.google.com/file/d/demo-ebook-day-hoc-tich-cuc/view",
  },
];

interface DemoReviewDef {
  product: ProductKey;
  rating: number;
  body: string | null;
  reply?: string;
  hideAsSpam?: boolean;
}

interface DemoCustomerDef {
  email: string;
  fullName: string;
  buys: ProductKey[];
  reviews: DemoReviewDef[];
}

const DEMO_CUSTOMERS: DemoCustomerDef[] = [
  {
    email: "demo+minhanh@gieochu.test",
    fullName: "Nguyễn Minh Anh",
    buys: ["free", "sale", "full"],
    reviews: [
      {
        product: "free",
        rating: 5,
        body: "Đề ra rất sát chương trình, có cả ma trận nên mình chỉnh lại cho lớp mình rất nhanh. Cảm ơn cô nhiều ạ!",
        reply: "Cảm ơn chị Minh Anh đã tin dùng! Học kỳ II mình sẽ cập nhật thêm bộ đề mới, chị nhớ ghé lại nhé.",
      },
      { product: "sale", rating: 4, body: "Slide đẹp, bố cục rõ ràng. Một vài bài hơi nhiều chữ, mình phải lược bớt khi dạy." },
      { product: "full", rating: 5, body: null },
    ],
  },
  {
    email: "demo+thuha@gieochu.test",
    fullName: "Trần Thu Hà",
    buys: ["free", "sale"],
    reviews: [
      { product: "free", rating: 4, body: "Đáp án chi tiết, học sinh tự chấm được. Mong có thêm phần đề nâng cao cho lớp chọn." },
      { product: "sale", rating: 3, body: "Nội dung ổn nhưng font chữ trên máy mình bị lỗi, phải cài thêm font mới hiển thị đúng." },
    ],
  },
  {
    email: "demo+quocbao@gieochu.test",
    fullName: "Lê Quốc Bảo",
    buys: ["sale", "full"],
    reviews: [
      { product: "sale", rating: 5, body: "Tiết kiệm cho mình rất nhiều thời gian soạn bài. Phiếu học tập in ra dùng luôn được." },
      {
        product: "full",
        rating: 2,
        body: "Phần lý thuyết khá dài, ví dụ minh hoạ chưa nhiều như mình mong đợi.",
        reply:
          "Cảm ơn anh Bảo đã góp ý thẳng thắn. Bản cập nhật tháng tới sẽ bổ sung 10 giáo án minh hoạ, anh tải lại miễn phí trong thư viện nhé.",
      },
    ],
  },
  {
    email: "demo+ngoclan@gieochu.test",
    fullName: "Phạm Ngọc Lan",
    buys: ["free", "full"],
    reviews: [
      { product: "free", rating: 5, body: null },
      {
        product: "full",
        rating: 5,
        body: "Ai cần combo tài liệu giá rẻ hơn inbox zalo 0909 000 000, bên mình bán đủ bộ chỉ 50k!!!",
        hideAsSpam: true,
      },
    ],
  },
  {
    // Có đơn nhưng CHƯA đánh giá — để thử form viết đánh giá.
    email: "demo+thanhtung@gieochu.test",
    fullName: "Võ Thanh Tùng",
    buys: ["free", "sale"],
    reviews: [],
  },
];

const DEMO_EMAILS = DEMO_CUSTOMERS.map((c) => c.email);
const DEMO_PRODUCT_SLUGS = DEMO_PRODUCTS.map((p) => p.slug);

// ───────────────────────── Chốt an toàn ─────────────────────────

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function refuse(message: string): never {
  console.error(`\n[demo] TỪ CHỐI CHẠY: ${message}\n`);
  process.exit(1);
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Chỉ chạy khi: NODE_ENV khác production (cả trước lẫn sau khi nạp .env), có ALLOW_DEMO_SEED=1, APP_URL trỏ
 * localhost (dấu hiệu môi trường dev), và host của DATABASE_URL không nằm trong DEMO_SEED_BLOCKED_DB_HOSTS
 * (danh sách host DB prod/staging, phân tách bằng dấu phẩy — tuỳ chọn).
 */
function assertDevEnvironment(): void {
  // Hàm (không so sánh trực tiếp) để TS không thu hẹp kiểu NODE_ENV qua lần nạp .env.
  const isProduction = (): boolean => process.env.NODE_ENV === "production";
  if (isProduction()) refuse("NODE_ENV=production.");
  loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
  if (isProduction()) refuse("NODE_ENV=production (từ .env).");
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    refuse("thiếu ALLOW_DEMO_SEED=1 (đặt biến này để xác nhận đây là DB dev).");
  }

  const env = getEnv();
  const appHost = hostOf(env.APP_URL);
  if (!appHost || !LOCAL_HOSTS.has(appHost)) refuse(`APP_URL (${env.APP_URL}) không phải localhost — không giống môi trường dev.`);

  const dbHost = hostOf(env.DATABASE_URL);
  if (!dbHost) refuse("DATABASE_URL không đọc được host.");
  const blocked = (process.env.DEMO_SEED_BLOCKED_DB_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (blocked.some((b) => dbHost === b || dbHost.endsWith(`.${b}`))) {
    refuse(`host DB ${dbHost} nằm trong DEMO_SEED_BLOCKED_DB_HOSTS.`);
  }
  console.log(`[demo] DB host: ${dbHost} — APP_URL: ${env.APP_URL}`);
}

// ───────────────────────── Dọn dữ liệu demo ─────────────────────────

async function requireTenant() {
  // tenants: đọc trực tiếp như createOrder/requireWritableTenant (lib).
  const tenant = await getPrismaClient().tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    throw new Error(`Không tìm thấy tenant "${TENANT_SLUG}". Hãy đăng nhập tài khoản chủ dự án và tạo trang có slug "${TENANT_SLUG}" trước.`);
  }
  return tenant;
}

async function cleanDemo(): Promise<void> {
  const prisma = getPrismaClient();
  const tenant = await requireTenant();
  const demoUsers = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: { id: true, email: true } });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoProducts = await withTenant(tenant.id, (tx) =>
    tx.product.findMany({ where: { tenantId: tenant.id, slug: { in: DEMO_PRODUCT_SLUGS } }, select: { id: true } }),
  );
  const demoProductIds = demoProducts.map((p) => p.id);

  // Chặn: có người KHÔNG thuộc danh sách demo đã mua sản phẩm demo → không tự xoá đơn của họ.
  if (demoProductIds.length > 0) {
    const foreign = await withTenant(tenant.id, (tx) =>
      tx.orderItem.count({ where: { productId: { in: demoProductIds }, order: { customerId: { notIn: demoUserIds } } } }),
    );
    if (foreign > 0) {
      throw new Error(
        `Có ${foreign} dòng đơn của tài khoản KHÔNG phải demo chứa sản phẩm demo — dừng, không xoá. Hãy xử lý tay các đơn đó trước.`,
      );
    }
  }

  // 1) Đánh giá của khách demo — chỉ scope customer được DELETE (RLS reviews).
  const touchedProductIds = new Set<string>();
  for (const userId of demoUserIds) {
    await withCustomer(userId, async (tx) => {
      const rows = await tx.review.findMany({ where: { userId }, select: { productId: true } });
      rows.forEach((r) => touchedProductIds.add(r.productId));
      await tx.review.deleteMany({ where: { userId } });
    });
  }

  // 2) Dữ liệu L2 của khách demo ở mọi tenant (thường chỉ phongweb) — xoá dưới scope của đúng tenant đó.
  const tenantIds = new Set<string>([tenant.id]);
  if (demoUserIds.length > 0) {
    const rows = await withSystemJob(async (tx) => {
      const [orders, ents, customers] = await Promise.all([
        tx.order.findMany({ where: { customerId: { in: demoUserIds } }, select: { tenantId: true } }),
        tx.entitlement.findMany({ where: { userId: { in: demoUserIds } }, select: { tenantId: true } }),
        tx.tenantCustomer.findMany({ where: { userId: { in: demoUserIds } }, select: { tenantId: true } }),
      ]);
      return [...orders, ...ents, ...customers];
    });
    rows.forEach((r) => tenantIds.add(r.tenantId));
  }

  const counts = { downloadEvents: 0, entitlements: 0, orders: 0, tenantCustomers: 0, products: 0 };
  for (const tenantId of tenantIds) {
    await withTenant(tenantId, async (tx: Tx) => {
      const ownedProductIds = tenantId === tenant.id ? demoProductIds : [];
      const events = await tx.downloadEvent.deleteMany({
        where: {
          tenantId,
          OR: [
            { userId: { in: demoUserIds } },
            { entitlement: { userId: { in: demoUserIds } } },
            { file: { productId: { in: ownedProductIds } } },
          ],
        },
      });
      const ents = await tx.entitlement.deleteMany({ where: { tenantId, userId: { in: demoUserIds } } });
      const orders = await tx.order.deleteMany({ where: { tenantId, customerId: { in: demoUserIds } } });
      const customers = await tx.tenantCustomer.deleteMany({ where: { tenantId, userId: { in: demoUserIds } } });
      // product_files / share_links / reviews còn lại → FK CASCADE.
      const products = await tx.product.deleteMany({ where: { tenantId, id: { in: ownedProductIds } } });
      counts.downloadEvents += events.count;
      counts.entitlements += ents.count;
      counts.orders += orders.count;
      counts.tenantCustomers += customers.count;
      counts.products += products.count;
    });
  }

  // 3) L1: user demo (profile, refresh/verification/download token → CASCADE).
  const users = await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });

  // 4) Danh mục demo — chỉ xoá khi không còn sản phẩm nào (kể cả sản phẩm thật) dùng nó.
  let categoryNote = "không có";
  const category = await prisma.documentCategory.findUnique({ where: { slug: DEMO_CATEGORY_SLUG }, select: { id: true } });
  if (category) {
    const inUse = await withSystemJob((tx) => tx.product.count({ where: { categoryId: category.id } }));
    if (inUse > 0) {
      categoryNote = `GIỮ LẠI (${inUse} sản phẩm khác đang dùng)`;
    } else {
      await prisma.documentCategory.delete({ where: { id: category.id } });
      categoryNote = "đã xoá";
    }
  }

  // 5) Sản phẩm thật từng được khách demo đánh giá → tính lại điểm.
  const remaining = [...touchedProductIds].filter((id) => !demoProductIds.includes(id));
  await recomputeProductRatings(remaining);

  console.log(
    `[demo] đã dọn: ${users.count} user, ${counts.products} sản phẩm, ${counts.orders} đơn, ${counts.entitlements} entitlement, ` +
      `${counts.tenantCustomers} tenant_customers, ${counts.downloadEvents} download_events, ${touchedProductIds.size} sản phẩm có review; danh mục demo: ${categoryNote}.`,
  );
}

// ───────────────────────── Seed ─────────────────────────

/** Ảnh bìa: URL Cloudinary có sẵn trong DB (ưu tiên đúng cloud hệ thống), nếu không có thì `<cloud>/image/upload/sample`. */
async function resolveCoverImageUrl(): Promise<string> {
  const prisma = getPrismaClient();
  const config = await prisma.systemCloudinaryConfig.findUnique({ where: { id: "default" }, select: { publicConfig: true } });
  const cloudName = (config?.publicConfig as { cloudName?: unknown } | null)?.cloudName;
  const systemCloud = typeof cloudName === "string" && cloudName ? cloudName : null;

  const categories = await prisma.documentCategory.findMany({ select: { imageUrl: true, ogImageUrl: true } });
  const productCovers = await withSystemJob((tx) =>
    tx.product.findMany({ where: { coverImageUrl: { not: null } }, select: { coverImageUrl: true }, take: 20 }),
  );
  const candidates = [
    ...productCovers.map((p) => p.coverImageUrl),
    ...categories.flatMap((c) => [c.imageUrl, c.ogImageUrl]),
  ].filter((u): u is string => typeof u === "string" && isCloudinaryImageUrl(u));

  const preferred = candidates.find((u) => (systemCloud ? isCloudinaryImageUrl(u, systemCloud) : true)) ?? candidates[0];
  if (preferred) return preferred;
  if (!systemCloud) throw new Error("Không tìm thấy ảnh Cloudinary nào trong DB và chưa cấu hình Cloudinary hệ thống — không có ảnh bìa hợp lệ.");
  return `https://res.cloudinary.com/${systemCloud}/image/upload/sample`;
}

async function resolveCategoryId(): Promise<{ id: string; name: string; created: boolean }> {
  const prisma = getPrismaClient();
  const active = await prisma.documentCategory.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (active) return { ...active, created: false };
  const created = await prisma.documentCategory.create({
    data: { slug: DEMO_CATEGORY_SLUG, name: "Tài liệu mẫu (demo)", shortDescription: "Danh mục tạo bởi script demo — xoá bằng demo:clean.", isActive: true },
    select: { id: true, name: true },
  });
  return { ...created, created: true };
}

async function uniqueOrderCode(prefix: string): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const code = generateOrderCode(prefix);
    const taken = await withSystemJob((tx) => tx.order.count({ where: { code } }));
    if (taken === 0) return code;
  }
  throw new Error("Không sinh được mã đơn duy nhất.");
}

/**
 * Cùng hình dạng createOrder (lib/order.ts): giá tính lại ở server bằng calculateOrderPricing, đơn PENDING dưới
 * withTenant, rồi markOrderPaid (PENDING → PAID → FULFILLED, entitlement + tenant_customers). Đơn 0đ đi nhánh
 * ZERO_AMOUNT; đơn có phí đi nhánh xác nhận thủ công (có confirmNote) như confirmOrderManually — bỏ bước gửi email.
 */
async function createFulfilledOrder(tenant: { id: string; orderCodePrefix: string }, customerId: string, productId: string): Promise<string> {
  const now = new Date();
  const product = await withTenant(tenant.id, (tx) => tx.product.findFirstOrThrow({ where: { id: productId, tenantId: tenant.id, status: "PUBLISHED" } }));
  const pricing = calculateOrderPricing(
    [
      {
        productId: product.id,
        title: product.title,
        priceVnd: product.priceVnd,
        salePriceVnd: product.salePriceVnd,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      },
    ],
    null,
    0,
    now,
  );
  const code = await uniqueOrderCode(tenant.orderCodePrefix);
  const expiresAt = computeOrderExpiresAt(now, getEnv().ORDER_PENDING_TTL_MINUTES);

  return withTenant(tenant.id, async (tx) => {
    const order = await tx.order.create({
      data: {
        tenantId: tenant.id,
        customerId,
        code,
        status: "PENDING",
        subtotalVnd: pricing.subtotalVnd,
        discountVnd: pricing.discountVnd,
        totalVnd: pricing.totalVnd,
        expiresAt,
        items: {
          create: pricing.lines.map((line) => ({
            productId: line.productId,
            titleSnapshot: line.titleSnapshot,
            unitPriceVnd: line.unitPriceVnd,
            finalPriceVnd: line.finalPriceVnd,
          })),
        },
      },
    });
    if (order.totalVnd === 0) {
      await markOrderPaid(tx, order.id, "ZERO_AMOUNT");
    } else {
      await tx.order.update({ where: { id: order.id }, data: { confirmNote: DEMO_NOTE } });
      await markOrderPaid(tx, order.id, "MANUAL_CONFIRM");
    }
    return order.code;
  });
}

async function seedDemo(): Promise<void> {
  const env = getEnv();
  const prisma = getPrismaClient();
  const tenant = await requireTenant();
  if (tenant.status !== "ACTIVE") throw new Error(`Tenant "${TENANT_SLUG}" đang ${tenant.status} — không xuất bản/bán được.`);

  const category = await resolveCategoryId();
  const coverImageUrl = await resolveCoverImageUrl();
  const imageCloudName = await getSystemCloudinaryCloudName();

  // Sản phẩm: tạo nháp → thêm link ngoài → publishProduct (canPublishProduct + giới hạn gói, không bỏ qua).
  const productIdByKey = new Map<ProductKey, string>();
  for (const def of DEMO_PRODUCTS) {
    const now = new Date();
    const created = await createProduct(tenant.id, {
      title: def.title,
      slug: def.slug,
      summary: def.summary,
      description: sanitizeRichTextHtml(def.descriptionHtml, { imageCloudName }),
      coverImageUrl,
      type: def.type,
      categoryId: category.id,
      tags: def.tags,
      priceVnd: def.priceVnd,
      salePriceVnd: def.salePriceVnd,
      saleStartsAt: def.salePriceVnd != null ? now : null,
      saleEndsAt: def.saleDays != null ? new Date(now.getTime() + def.saleDays * 24 * 60 * 60 * 1000) : null,
    });
    if (created.slug !== def.slug) {
      throw new Error(`Slug "${def.slug}" đã bị chiếm trong tenant (được đổi thành "${created.slug}") — dừng để tránh lẫn dữ liệu thật.`);
    }
    await addProductExternalLink(tenant.id, created.id, { label: def.linkLabel, url: def.linkUrl });
    await publishProduct(tenant.id, created.id);
    productIdByKey.set(def.key, created.id);
  }
  const pid = (key: ProductKey): string => productIdByKey.get(key)!;

  // Khách demo (L1) — đã xác minh email, hồ sơ có họ tên (displayName đánh giá lấy từ đây).
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();
  const userIdByEmail = new Map<string, string>();
  for (const c of DEMO_CUSTOMERS) {
    const user = await prisma.user.create({
      data: {
        email: c.email,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: now,
        profileCompletedAt: now,
        profile: { create: { fullName: c.fullName, consentAt: now } },
      },
    });
    userIdByEmail.set(c.email, user.id);
  }

  // Đơn FULFILLED + entitlement.
  const ordersByEmail = new Map<string, string[]>();
  for (const c of DEMO_CUSTOMERS) {
    const codes: string[] = [];
    for (const key of c.buys) codes.push(await createFulfilledOrder(tenant, userIdByEmail.get(c.email)!, pid(key)));
    ordersByEmail.set(c.email, codes);
  }

  // Đánh giá qua upsertMyReview (RLS customer: đòi đơn FULFILLED + entitlement chưa thu hồi), rồi trả lời / ẩn
  // qua lib Studio (RLS tenant + trigger reviews_guard_columns).
  for (const c of DEMO_CUSTOMERS) {
    const userId = userIdByEmail.get(c.email)!;
    for (const r of c.reviews) {
      const { review } = await upsertMyReview(userId, pid(r.product), { rating: r.rating, body: r.body ?? "" });
      if (r.reply) await replyToReview(tenant.id, review.id, r.reply);
      if (r.hideAsSpam) await hideReview(tenant.id, review.id, "SPAM");
    }
  }
  await recomputeProductRatings([...productIdByKey.values()]);

  // ───── Báo cáo ─────
  const stats = await withTenant(tenant.id, async (tx) => {
    const products = await tx.product.findMany({
      where: { tenantId: tenant.id, id: { in: [...productIdByKey.values()] } },
      select: { id: true, slug: true, title: true, status: true, priceVnd: true, salePriceVnd: true, ratingSum: true, ratingCount: true },
    });
    const grouped = await tx.review.groupBy({ by: ["productId", "status"], where: { tenantId: tenant.id, productId: { in: products.map((p) => p.id) } }, _count: true });
    return { products, grouped };
  });

  const base = env.APP_URL.replace(/\/$/, "");
  console.log("\n================ DỮ LIỆU DEMO ĐÃ SẴN SÀNG ================");
  console.log(`Danh mục dùng: ${category.name}${category.created ? " (tạo mới, demo)" : " (có sẵn)"}`);
  console.log(`Ảnh bìa: ${coverImageUrl}`);
  console.log(`\nStorefront:            ${base}/${TENANT_SLUG}`);
  console.log(`Studio – Đánh giá:     ${base}/studio/${TENANT_SLUG}/reviews`);
  console.log(`Studio – Sản phẩm:     ${base}/studio/${TENANT_SLUG}/products`);
  console.log("\nSản phẩm:");
  for (const p of stats.products) {
    const visible = stats.grouped.find((g) => g.productId === p.id && g.status === "VISIBLE")?._count ?? 0;
    const hidden = stats.grouped.find((g) => g.productId === p.id && g.status === "HIDDEN")?._count ?? 0;
    const price = p.priceVnd === 0 ? "Miễn phí" : p.salePriceVnd != null ? `${p.salePriceVnd.toLocaleString("vi-VN")}đ (gốc ${p.priceVnd.toLocaleString("vi-VN")}đ)` : `${p.priceVnd.toLocaleString("vi-VN")}đ`;
    console.log(`  - ${p.title} [${p.status}] — ${price}`);
    console.log(`    trang:   ${base}${productPath(TENANT_SLUG, p.slug)}`);
    console.log(`    editor:  ${base}/studio/${TENANT_SLUG}/products/${p.id}`);
    console.log(`    đánh giá: ${visible} hiển thị, ${hidden} ẩn — điểm TB ${computeRatingAverage(p.ratingSum, p.ratingCount) ?? "—"} (sum ${p.ratingSum}/count ${p.ratingCount})`);
  }
  console.log(`\nTài khoản khách demo (mật khẩu chung: ${DEMO_PASSWORD}) — thư viện: ${base}/account/library`);
  for (const c of DEMO_CUSTOMERS) {
    const bought = c.buys.map((k) => DEMO_PRODUCTS.find((d) => d.key === k)!.title).join(" | ");
    const reviewed = c.reviews.length === 0 ? "CHƯA đánh giá — dùng để thử form viết đánh giá" : `${c.reviews.length} đánh giá`;
    const notReviewed = c.buys.filter((k) => !c.reviews.some((r) => r.product === k));
    const extra = c.reviews.length > 0 && notReviewed.length > 0 ? `; chưa đánh giá: ${notReviewed.map((k) => DEMO_PRODUCTS.find((d) => d.key === k)!.slug).join(", ")}` : "";
    console.log(`  - ${c.email} (${c.fullName}) — đơn ${ordersByEmail.get(c.email)!.join(", ")} — ${reviewed}${extra}`);
    console.log(`      đã mua: ${bought}`);
  }
  console.log("\nDọn dữ liệu demo: ALLOW_DEMO_SEED=1 pnpm --filter @gieochu/db run demo:clean");
  console.log("==========================================================\n");
}

async function main() {
  const command = process.argv[2];
  if (command !== "seed" && command !== "clean") {
    console.error("Cách dùng: tsx scripts/demo-reviews.ts <seed|clean>");
    process.exit(1);
  }
  assertDevEnvironment();
  await cleanDemo();
  if (command === "seed") await seedDemo();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("\n[demo] LỖI:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  });
