import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import * as argon2 from "argon2";
import { getPrismaClient } from "../src/client";

// Monorepo has a single root .env, not one per package (see prisma.config.ts).
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// No hard-coded fallback on purpose: a well-known default admin credential
// baked into source is a real risk if this script is ever re-run against a
// live DB. Seeding the super admin is opt-in per environment.
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

async function seedSuperAdmin(prisma: ReturnType<typeof getPrismaClient>) {
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.log("[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD not set — skipping super admin seed.");
    return;
  }

  // A super admin is the one account nobody (incl. other admins) can lock or
  // demote (see packages/db/prisma/schema.prisma comment on User.isSuperAdmin).
  // Re-running this script must never create a second one.
  const existing = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (existing && existing.email !== SEED_ADMIN_EMAIL) {
    console.log(`[seed] a super admin already exists (${existing.email}) — skipping, not creating another.`);
    return;
  }

  const passwordHash = await argon2.hash(SEED_ADMIN_PASSWORD, { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: { isSuperAdmin: true },
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      systemRole: "SYSTEM_ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
      emailVerifiedAt: new Date(),
      profileCompletedAt: new Date(),
    },
  });
  // `isProfileComplete()` (packages/auth) checks the UserProfile row itself,
  // not `User.profileCompletedAt` — without this the seeded admin logs in
  // fine but gets redirected to /account/profile, and submitting that form
  // then fails (`userProfile.update` on a row that doesn't exist yet).
  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      fullName: "System Admin",
      phone: "0900000000",
      occupation: "Quản trị hệ thống",
      province: "Hà Nội",
      consentAt: new Date(),
    },
  });
  console.log(`[seed] super admin ready: ${SEED_ADMIN_EMAIL}`);
}

// §ADR-022 — Role/Permission là nguồn sự thật cho "tier này được làm gì".
// `Role.code` khớp 1-1 với giá trị enum SystemRole/TenantMemberRole hiện có
// (SYSTEM_ADMIN, TENANT_OWNER, TENANT_STAFF) — 2 enum đó vẫn là nhãn định
// danh, không đổi. Idempotent qua upsert theo `code`, chạy lại an toàn.
async function seedRbac(prisma: ReturnType<typeof getPrismaClient>) {
  const roles = [
    { code: "SYSTEM_ADMIN", scope: "SYSTEM" as const, name: "Quản trị hệ thống" },
    { code: "TENANT_OWNER", scope: "TENANT" as const, name: "Chủ gian hàng" },
    { code: "TENANT_STAFF", scope: "TENANT" as const, name: "Nhân viên gian hàng" },
  ];
  for (const role of roles) {
    await prisma.role.upsert({ where: { code: role.code }, update: role, create: role });
  }

  const permissions = [
    { code: "system:manage_users", description: "Quản lý người dùng hệ thống" },
    { code: "system:manage_plans", description: "Quản lý gói dịch vụ" },
    { code: "system:view_admin_dashboard", description: "Truy cập System Center" },
    { code: "tenant:access_studio", description: "Đăng nhập vào Studio của gian hàng" },
    { code: "tenant:manage_products", description: "Quản lý sản phẩm" },
    { code: "tenant:manage_orders", description: "Quản lý đơn hàng" },
    { code: "tenant:manage_payments", description: "Cấu hình phương thức thanh toán" },
    { code: "tenant:manage_staff", description: "Quản lý nhân viên gian hàng" },
    { code: "tenant:manage_settings", description: "Cấu hình gian hàng" },
  ];
  for (const permission of permissions) {
    await prisma.permission.upsert({ where: { code: permission.code }, update: permission, create: permission });
  }

  const rolePermissions: Record<string, string[]> = {
    SYSTEM_ADMIN: ["system:manage_users", "system:manage_plans", "system:view_admin_dashboard"],
    TENANT_OWNER: [
      "tenant:access_studio",
      "tenant:manage_products",
      "tenant:manage_orders",
      "tenant:manage_payments",
      "tenant:manage_staff",
      "tenant:manage_settings",
    ],
    // Tập khởi đầu — ma trận quyền staff đầy đủ là quyết định nghiệp vụ, chỉnh
    // sau qua DB/UI riêng (chưa làm ở seed này). Xem docs/BACKLOG.md.
    TENANT_STAFF: ["tenant:access_studio", "tenant:manage_products", "tenant:manage_orders"],
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  console.log(`[seed] ${roles.length} roles, ${permissions.length} permissions ready`);
}

async function main() {
  const prisma = getPrismaClient();

  await seedSuperAdmin(prisma);
  await seedRbac(prisma);

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      platformName: process.env.APP_NAME ?? "Gieo Chữ",
      supportEmail: process.env.SEED_SUPPORT_EMAIL ?? "support@gieochu.net",
      trialDays: Number(process.env.TRIAL_DAYS ?? 14),
      graceDays: Number(process.env.GRACE_DAYS ?? 7),
    },
  });
  console.log("[seed] system settings ready");

  // §"M3 v2" ADR-021 — Hybrid Monetization: FREE is a real, non-expiring plan every new
  // tenant gets (createTenantForUser reads isFree:true), not a time-boxed trial. Numbers here
  // are seed defaults only — every field is editable afterwards via /admin/plans.
  const plans = [
    {
      code: "FREE",
      name: "Free",
      priceVnd: 0,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 5,
      storageMb: 500,
      maxFileMb: 50,
      imageStorageMb: 100,
      isFree: true,
      features: {},
    },
    {
      code: "CREATOR",
      name: "Creator",
      priceVnd: 99_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 50,
      storageMb: 5_000,
      maxFileMb: 250,
      imageStorageMb: 1_024,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true },
    },
    {
      code: "PRO",
      name: "Pro",
      priceVnd: 199_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 200,
      storageMb: 20_000,
      maxFileMb: 1_000,
      imageStorageMb: 2_048,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true, seoTools: true, automation: true },
    },
    {
      code: "BUSINESS",
      name: "Business",
      priceVnd: 499_000,
      interval: "MONTH" as const,
      intervalCount: 1,
      maxProducts: 1_000,
      storageMb: 100_000,
      maxFileMb: 2_000,
      imageStorageMb: 5_120,
      isFree: false,
      features: { coupons: true, advancedAnalytics: true, advancedBranding: true, seoTools: true, automation: true, customDomain: true },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
  console.log(`[seed] ${plans.length} plans ready`);

  // §"Landing Page CMS" — nội dung mặc định của trang chủ, đúng khớp bản đã
  // build tay ở apps/web/app/page.tsx trước khi chuyển sang CMS-driven. Ghi cả
  // vào `update` (không chỉ `create`): đây là migration đổi hẳn định dạng
  // blocks (object phẳng -> mảng section có thứ tự) — bản cũ không tương thích
  // với `homeSectionsSchema` nữa nên bắt buộc phải ghi đè, không thể giữ nguyên.
  const HOME_SECTIONS = [
    {
      id: "hero-main",
      type: "hero",
      visible: true,
      data: {
        badge: "Nền tảng dành cho người có kiến thức",
        title: "Kiến thức của bạn xứng đáng được nhiều người biết đến",
        subtitle:
          "Tạo không gian chia sẻ kiến thức của riêng bạn. Xuất bản học liệu, chia sẻ điều bạn biết, kết nối với người học và phát triển từ những giá trị bạn tạo ra.",
        primaryCta: { label: "Bắt đầu gieo chữ miễn phí", href: "/register" },
        secondaryCta: { label: "Khám phá Gieo Chữ", href: "/pricing" },
      },
    },
    {
      id: "stats-main",
      type: "stats",
      visible: true,
      data: {
        items: [
          { value: "500+", label: "Người bán hoạt động" },
          { value: "10.000+", label: "Tài liệu chất lượng" },
          { value: "4.8/5", label: "Đánh giá trung bình" },
          { value: "50.000+", label: "Lượt tải xuống" },
        ],
      },
    },
    {
      id: "search-main",
      type: "search",
      visible: true,
      data: {
        title: "Tìm tài liệu bạn cần",
        subtitle: "Giáo án, đề thi, slide bài giảng, bộ đề luyện thi và hơn thế nữa",
        placeholder: "Tìm theo tên tài liệu, môn học, giáo viên...",
        chips: ["Giáo án", "Đề thi", "Slide bài giảng", "Bộ đề luyện thi", "Khoá học online"],
      },
    },
    {
      id: "benefits-main",
      type: "benefits",
      visible: true,
      data: {
        eyebrow: "VÌ SAO GIEO CHỮ",
        title: "Được xây dựng riêng cho người dạy học",
        description: "Không cần đội ngũ kỹ thuật, không cần website riêng — mọi công cụ để bán tài liệu và xây thương hiệu cá nhân đều có sẵn.",
        items: [
          { title: "Bắt đầu miễn phí", description: "Mở gian hàng và đăng bán ngay, không mất phí khởi tạo hay phí duy trì." },
          { title: "Toàn quyền sáng tạo", description: "Tự thiết kế trang bán hàng, đặt giá và tạo mã giảm giá theo ý bạn." },
          { title: "Thanh toán trực tiếp", description: "Doanh thu bán tài liệu về thẳng tài khoản ngân hàng của bạn." },
          { title: "Kết nối học viên thật", description: "Tiếp cận hàng nghìn học viên và phụ huynh đang tìm tài liệu chất lượng." },
        ],
      },
    },
    {
      id: "coaches-main",
      type: "coaches",
      visible: true,
      data: {
        title: "Giáo viên & Coach nổi bật",
        subtitle: "Những người bán được học viên đánh giá cao nhất trên Gieo Chữ",
        items: [
          { name: "Cô Hạnh Toán", subject: "Toán THPT", rating: "4.9", reviews: "128", sold: "850+ lượt bán · 32 tài liệu" },
          { name: "Thầy An Vật Lý", subject: "Vật lý THCS", rating: "4.8", reviews: "96", sold: "610+ lượt bán · 21 tài liệu" },
          { name: "Coach Minh Anh", subject: "Kỹ năng mềm", rating: "5.0", reviews: "74", sold: "420+ lượt bán · 15 tài liệu" },
          { name: "Thầy Long Tiếng Anh", subject: "Tiếng Anh giao tiếp", rating: "4.9", reviews: "203", sold: "1.200+ lượt bán · 40 tài liệu" },
        ],
      },
    },
    {
      id: "documents-main",
      type: "documents",
      visible: true,
      data: {
        title: "Tài liệu nổi bật",
        subtitle: "Được học viên tin dùng và đánh giá cao nhất tuần này",
        items: [
          { tag: "Đề thi", title: "Bộ đề thi thử THPT Quốc gia 2026 — Môn Toán (có đáp án chi tiết)", seller: "Cô Hạnh Toán", rating: "4.9", sold: "210 lượt mua", price: "129.000đ" },
          { tag: "Giáo án", title: "Giáo án Ngữ văn lớp 10 trọn bộ theo chương trình mới 2026", seller: "Thầy Minh Văn", rating: "4.7", sold: "156 lượt mua", price: "89.000đ" },
          { tag: "Slide", title: "Slide bài giảng Tiếng Anh giao tiếp cho người mới bắt đầu", seller: "Coach Minh Anh", rating: "5.0", sold: "98 lượt mua", price: "199.000đ" },
        ],
      },
    },
    {
      id: "become-seller-main",
      type: "becomeSeller",
      visible: true,
      data: {
        eyebrow: "DÀNH CHO NGƯỜI CÓ KIẾN THỨC",
        title: "Bạn là giáo viên, coach hay chuyên gia?",
        highlight: "Mở gian hàng trên Gieo Chữ ngay hôm nay.",
        bullets: ["Miễn phí trọn đời với gói Free", "Không giới hạn sáng tạo nội dung", "Thanh toán an toàn, minh bạch", "Quản lý đơn hàng & khách hàng dễ dàng"],
        cta: { label: "Bắt đầu gieo chữ hôm nay", href: "/register" },
      },
    },
    {
      id: "testimonials-main",
      type: "testimonials",
      visible: true,
      data: {
        items: [
          { quote: "Chỉ sau một tuần mở gian hàng, tôi đã có đơn hàng đầu tiên. Giao diện dễ dùng, không cần biết lập trình.", name: "Cô Thanh Hương", role: "Giáo viên Toán — TP.HCM" },
          { quote: "Gieo Chữ giúp tôi biến tài liệu ôn thi thành nguồn thu nhập ổn định mỗi tháng.", name: "Thầy Quốc Bảo", role: "Giáo viên Hoá — Hà Nội" },
          { quote: "Công cụ quản lý đơn hàng và khách hàng rất trực quan, tôi theo dõi doanh thu dễ dàng.", name: "Coach Minh Anh", role: "Huấn luyện kỹ năng mềm" },
        ],
      },
    },
    {
      id: "final-cta-main",
      type: "finalCta",
      visible: true,
      data: {
        title: "Sẵn sàng gieo những hạt giống tri thức đầu tiên?",
        subtitle: "Mở gian hàng miễn phí trong 5 phút — không cần thẻ tín dụng.",
        cta: { label: "Bắt đầu miễn phí ngay", href: "/register" },
      },
    },
  ];
  
  await prisma.cmsPage.upsert({
    where: { slug: "home" },
    update: { blocks: HOME_SECTIONS, blocksDraft: null, status: "PUBLISHED" },
    create: {
      slug: "home",
      title: "Trang chủ",
      status: "PUBLISHED",
      seoTitle: "Gieo Chữ – Nền tảng bán học liệu cho giáo viên",
      seoDescription: "Mở trang bán tài liệu số của riêng bạn: template, slide bài giảng, ebook, bộ đề.",
      blocks: HOME_SECTIONS,
    },
  });
  console.log("[seed] CMS home page ready (Landing Page CMS sections)");

  // §"M7": NAPAS/VietQR BIN list, verified against vietqr.co/banks before seeding.
  const bankBins = [
    { bin: "970405", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", shortName: "Agribank" },
    { bin: "970415", name: "Ngân hàng TMCP Công Thương Việt Nam", shortName: "VietinBank" },
    { bin: "970436", name: "Ngân hàng TMCP Ngoại Thương Việt Nam", shortName: "Vietcombank" },
    { bin: "970418", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", shortName: "BIDV" },
    { bin: "970403", name: "Ngân hàng TMCP Sài Gòn Thương Tín", shortName: "Sacombank" },
    { bin: "970407", name: "Ngân hàng TMCP Kỹ thương Việt Nam", shortName: "Techcombank" },
    { bin: "970422", name: "Ngân hàng TMCP Quân đội", shortName: "MB Bank" },
    { bin: "970423", name: "Ngân hàng TMCP Tiên Phong", shortName: "TPBank" },
    { bin: "970425", name: "Ngân hàng TMCP An Bình", shortName: "ABBANK" },
    { bin: "970426", name: "Ngân hàng TMCP Hàng Hải", shortName: "MSB" },
    { bin: "970416", name: "Ngân hàng TMCP Á Châu", shortName: "ACB" },
    { bin: "970429", name: "Ngân hàng TMCP Sài Gòn", shortName: "SCB" },
    { bin: "970431", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam", shortName: "Eximbank" },
    { bin: "970432", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", shortName: "VPBank" },
    { bin: "970437", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh", shortName: "HDBank" },
    { bin: "970440", name: "Ngân hàng TMCP Đông Nam Á", shortName: "SeABank" },
    { bin: "970441", name: "Ngân hàng TMCP Quốc tế Việt Nam", shortName: "VIB" },
    { bin: "970443", name: "Ngân hàng TMCP Sài Gòn - Hà Nội", shortName: "SHB" },
    { bin: "970448", name: "Ngân hàng TMCP Phương Đông", shortName: "OCB" },
  ];

  for (const bank of bankBins) {
    await prisma.bankBin.upsert({ where: { bin: bank.bin }, update: bank, create: bank });
  }
  console.log(`[seed] ${bankBins.length} bank BINs ready`);
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrismaClient().$disconnect();
  });
