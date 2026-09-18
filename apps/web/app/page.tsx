import Link from "next/link";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import { getBrand } from "@gieochu/config/brand";

const lora = Lora({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700"], variable: "--font-serif" });
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const INK = "#1C2333";
const INK_SOFT = "#5B6070";
const PAPER = "#FBF8F2";
const PAPER_ALT = "#F2ECDD";
const LINE = "#E7DFCB";
const BLUE = "#1D4ED8";
const BLUE_DEEP = "#142A63";
const AMBER = "#C4700A";
const AMBER_SOFT = "#F4E3C4";
const GREEN = "#166B3F";

function IconSprout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V11" />
      <path d="M12 11c0-4 3-6 7-6 0 4-2 7-7 7Z" />
      <path d="M12 14c0-3.2-2.4-5-6-5 0 3.2 2 5.6 6 5Z" />
    </svg>
  );
}

function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-1 2-2 0-.6-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.7-9-7.7Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

function IconCheck({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function IconSearch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

function IconDocs({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5h6.5L19 8v11.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14.2 3.5V8h4.6" />
      <path d="M9.5 12.5h5M9.5 15.5h5M9.5 18h3" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.8l2.7 5.6 6.1.8-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.8Z" />
    </svg>
  );
}

function Stars({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={`flex gap-0.5 ${className ?? ""}`} style={{ color: AMBER }}>
      {Array.from({ length: count }).map((_, i) => (
        <IconStar key={i} className="h-3.5 w-3.5" />
      ))}
    </div>
  );
}

const BENEFITS = [
  { Icon: IconSprout, bg: AMBER_SOFT, fg: AMBER, title: "Bắt đầu miễn phí", desc: "Mở gian hàng và đăng bán ngay, không mất phí khởi tạo hay phí duy trì." },
  { Icon: IconPalette, bg: "#DCE6FB", fg: BLUE, title: "Toàn quyền sáng tạo", desc: "Tự thiết kế trang bán hàng, đặt giá và tạo mã giảm giá theo ý bạn." },
  { Icon: IconWallet, bg: "#DAEFE1", fg: GREEN, title: "Thanh toán trực tiếp", desc: "Doanh thu bán tài liệu về thẳng tài khoản ngân hàng của bạn." },
  { Icon: IconUsers, bg: AMBER_SOFT, fg: AMBER, title: "Kết nối học viên thật", desc: "Tiếp cận hàng nghìn học viên và phụ huynh đang tìm tài liệu chất lượng." },
];

const COACHES = [
  { initials: "HT", bg: BLUE, name: "Cô Hạnh Toán", subject: "Toán THPT", rating: "4.9", reviews: "128", sold: "850+ lượt bán · 32 tài liệu" },
  { initials: "AV", bg: AMBER, name: "Thầy An Vật Lý", subject: "Vật lý THCS", rating: "4.8", reviews: "96", sold: "610+ lượt bán · 21 tài liệu" },
  { initials: "MA", bg: GREEN, name: "Coach Minh Anh", subject: "Kỹ năng mềm", rating: "5.0", reviews: "74", sold: "420+ lượt bán · 15 tài liệu" },
  { initials: "TL", bg: BLUE_DEEP, name: "Thầy Long Tiếng Anh", subject: "Tiếng Anh giao tiếp", rating: "4.9", reviews: "203", sold: "1.200+ lượt bán · 40 tài liệu" },
];

const DOCS = [
  { tag: "Đề thi", tagBg: "#DCE6FB", tagFg: BLUE, coverBg: "#DCE6FB", coverFg: BLUE, title: "Bộ đề thi thử THPT Quốc gia 2026 — Môn Toán (có đáp án chi tiết)", seller: "Cô Hạnh Toán", sellerColor: BLUE, rating: "4.9", sold: "210 lượt mua", price: "129.000đ" },
  { tag: "Giáo án", tagBg: AMBER_SOFT, tagFg: AMBER, coverBg: AMBER_SOFT, coverFg: AMBER, title: "Giáo án Ngữ văn lớp 10 trọn bộ theo chương trình mới 2026", seller: "Thầy Minh Văn", sellerColor: AMBER, rating: "4.7", sold: "156 lượt mua", price: "89.000đ" },
  { tag: "Slide", tagBg: "#DAEFE1", tagFg: GREEN, coverBg: "#DAEFE1", coverFg: GREEN, title: "Slide bài giảng Tiếng Anh giao tiếp cho người mới bắt đầu", seller: "Coach Minh Anh", sellerColor: GREEN, rating: "5.0", sold: "98 lượt mua", price: "199.000đ" },
];

const TESTIMONIALS = [
  { quote: "Chỉ sau một tuần mở gian hàng, tôi đã có đơn hàng đầu tiên. Giao diện dễ dùng, không cần biết lập trình.", name: "Cô Thanh Hương", role: "Giáo viên Toán — TP.HCM", bg: BLUE },
  { quote: "Gieo Chữ giúp tôi biến tài liệu ôn thi thành nguồn thu nhập ổn định mỗi tháng.", name: "Thầy Quốc Bảo", role: "Giáo viên Hoá — Hà Nội", bg: AMBER },
  { quote: "Công cụ quản lý đơn hàng và khách hàng rất trực quan, tôi theo dõi doanh thu dễ dàng.", name: "Coach Minh Anh", role: "Huấn luyện kỹ năng mềm", bg: GREEN },
];

export default function HomePage() {
  const brand = getBrand();

  return (
    <div className={`${lora.variable} ${beVietnamPro.variable} font-[family-name:var(--font-sans)]`} style={{ background: PAPER, color: INK }}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b px-5 sm:h-[88px] sm:px-10 lg:px-24" style={{ background: PAPER, borderColor: LINE }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] sm:h-[38px] sm:w-[38px]" style={{ background: BLUE }}>
            <span className="font-[family-name:var(--font-serif)] text-base font-bold text-white sm:text-lg">G</span>
          </div>
          <span className="font-[family-name:var(--font-serif)] text-lg font-bold sm:text-xl">{brand.name}</span>
        </Link>
        <nav className="hidden items-center gap-10 lg:flex">
          <Link href="/pricing" className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Bảng giá
          </Link>
          <span className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Giáo viên &amp; Coach
          </span>
          <span className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Khám phá tài liệu
          </span>
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link href="/login" className="hidden text-[15px] font-semibold sm:inline">
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="rounded-full px-4 py-2 text-[13px] font-bold sm:px-[22px] sm:py-[11px] sm:text-sm"
            style={{ background: AMBER, color: "#241503" }}
          >
            Mở gian hàng miễn phí
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        className="flex flex-col items-center gap-10 px-5 py-11 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-24 lg:py-24"
        style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #0E1E48 100%)` }}
      >
        <div className="flex w-full max-w-[560px] flex-col items-start gap-5 sm:gap-6">
          <span
            className="rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-[13.5px]"
            style={{ background: "rgba(255,255,255,0.1)", color: AMBER_SOFT, borderColor: "rgba(244,227,196,0.35)" }}
          >
            Nền tảng dành cho người dạy học
          </span>
          <h1 className="font-[family-name:var(--font-serif)] text-[32px] leading-[1.18] font-semibold text-white sm:text-[44px] lg:text-[52px] lg:leading-[1.12]">
            Gieo tri thức, gặt thành quả từ nghề dạy học
          </h1>
          <p className="max-w-[480px] text-[15px] leading-[1.65] text-white/70 sm:text-base lg:text-[17px]">
            {brand.name} là nơi giáo viên, coach và chuyên gia mở gian hàng, đăng bán tài liệu và kết nối với học viên
            khắp Việt Nam — miễn phí ngay từ ngày đầu, không cần biết lập trình.
          </p>
          <div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Link href="/register" className="rounded-full px-[30px] py-[15px] text-center text-[15px] font-bold sm:text-base" style={{ background: AMBER, color: "#241503" }}>
              Mở gian hàng miễn phí
            </Link>
            <Link href="/pricing" className="flex items-center justify-center gap-2 text-[15px] font-semibold text-white sm:justify-start">
              Khám phá tài liệu <IconArrow className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative h-[220px] w-full max-w-[420px] shrink-0 sm:h-[340px] lg:h-[420px] lg:w-[460px]">
          <div className="absolute top-2 right-4 h-40 w-40 rounded-full sm:h-56 sm:w-56 lg:h-80 lg:w-80" style={{ background: "rgba(196,112,10,0.35)" }} />
          <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full sm:h-40 sm:w-40 lg:h-56 lg:w-56" style={{ background: "rgba(22,107,63,0.35)" }} />

          <div
            className="absolute top-3 left-4 w-[190px] -rotate-3 rounded-[18px] bg-white p-5 shadow-2xl sm:top-8 sm:left-12 sm:w-[260px] sm:p-6 lg:top-[46px] lg:left-[70px] lg:w-[300px] lg:-rotate-[4deg] lg:p-[26px]"
            style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}
          >
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-[34px] sm:w-[34px] sm:rounded-[9px]" style={{ background: AMBER_SOFT, color: AMBER }}>
                <IconDocs className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs" style={{ background: AMBER_SOFT, color: AMBER }}>
                Đề thi
              </span>
            </div>
            <div className="mb-2.5 h-2.5 w-[90%] rounded-full" style={{ background: LINE }} />
            <div className="mb-2.5 h-2.5 w-[70%] rounded-full" style={{ background: LINE }} />
            <div className="h-2.5 w-[80%] rounded-full" style={{ background: LINE }} />
          </div>

          <div
            className="absolute top-0 right-0 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:gap-3 sm:px-[18px] sm:py-3.5"
            style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9" style={{ background: BLUE }}>
              <IconUsers className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" />
            </div>
            <div>
              <div className="text-[13px] leading-tight font-bold sm:text-[15px]">500+</div>
              <div className="text-[10px] leading-tight sm:text-xs" style={{ color: INK_SOFT }}>
                Giáo viên &amp; Coach
              </div>
            </div>
          </div>

          <div
            className="absolute right-1 bottom-3 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:right-1.5 sm:bottom-6 sm:gap-3 sm:px-[18px] sm:py-3.5"
            style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9" style={{ background: GREEN }}>
              <IconDocs className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" />
            </div>
            <div>
              <div className="text-[13px] leading-tight font-bold sm:text-[15px]">10.000+</div>
              <div className="text-[10px] leading-tight sm:text-xs" style={{ color: INK_SOFT }}>
                Tài liệu chất lượng
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="grid grid-cols-2 gap-6 px-5 py-8 sm:flex sm:items-center sm:justify-between sm:px-10 sm:py-10 lg:px-24" style={{ background: PAPER_ALT }}>
        {[
          ["500+", "Người bán hoạt động"],
          ["10.000+", "Tài liệu chất lượng"],
          ["4.8/5", "Đánh giá trung bình"],
          ["50.000+", "Lượt tải xuống"],
        ].map(([value, label]) => (
          <div key={label} className="text-center">
            <div className="font-[family-name:var(--font-serif)] text-[22px] font-bold sm:text-[26px] lg:text-[30px]" style={{ color: BLUE }}>
              {value}
            </div>
            <div className="mt-1 text-xs sm:text-sm" style={{ color: INK_SOFT }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      {/* Search */}
      <section className="flex flex-col items-center gap-4 px-5 py-14 text-center sm:px-10 sm:py-20 lg:px-24 lg:py-24">
        <h2 className="font-[family-name:var(--font-serif)] text-[25px] font-semibold sm:text-[30px] lg:text-[34px]">Tìm tài liệu bạn cần</h2>
        <p className="mb-1 text-sm sm:text-base" style={{ color: INK_SOFT }}>
          Giáo án, đề thi, slide bài giảng, bộ đề luyện thi và hơn thế nữa
        </p>
        <div
          className="flex w-full max-w-[680px] items-center gap-3 rounded-full border bg-white py-1.5 pr-1.5 pl-5"
          style={{ borderColor: LINE, boxShadow: "0 12px 30px rgba(28,35,51,0.06)" }}
        >
          <IconSearch className="h-[18px] w-[18px] shrink-0" style={{ color: INK_SOFT }} />
          <span className="grow truncate text-left text-[13.5px] sm:text-[15px]" style={{ color: INK_SOFT }}>
            Tìm theo tên tài liệu, môn học, giáo viên...
          </span>
          <button type="button" className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-bold text-white sm:px-[26px] sm:py-3 sm:text-sm" style={{ background: BLUE }}>
            Tìm kiếm
          </button>
        </div>
        <div className="mt-1 flex w-full gap-2.5 overflow-x-auto sm:w-auto sm:justify-center sm:overflow-visible">
          {["Giáo án", "Đề thi", "Slide bài giảng", "Bộ đề luyện thi", "Khoá học online"].map((label) => (
            <span key={label} className="shrink-0 rounded-full border bg-white px-4 py-2 text-xs font-semibold whitespace-nowrap sm:text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="flex flex-col gap-10 px-5 py-14 sm:px-10 sm:py-20 lg:flex-row lg:justify-between lg:gap-20 lg:px-24 lg:py-24" style={{ background: PAPER_ALT }}>
        <div className="lg:w-[400px] lg:shrink-0">
          <span className="text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER }}>
            VÌ SAO {brand.name.toUpperCase()}
          </span>
          <h2 className="mt-3.5 font-[family-name:var(--font-serif)] text-[25px] leading-[1.3] font-semibold sm:text-[28px] lg:text-[32px] lg:leading-[1.25]">
            Được xây dựng riêng cho người dạy học
          </h2>
          <p className="mt-4 text-[14.5px] leading-[1.7] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            Không cần đội ngũ kỹ thuật, không cần website riêng — mọi công cụ để bán tài liệu và xây thương hiệu cá
            nhân đều có sẵn.
          </p>
        </div>
        <div className="grid grow grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-7">
          {BENEFITS.map(({ Icon, bg, fg, title, desc }) => (
            <div key={title} className="rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={{ background: bg, color: fg }}>
                <Icon className="h-[22px] w-[22px] sm:h-6 sm:w-6" />
              </div>
              <div className="mb-2 text-base font-bold sm:text-[17px]">{title}</div>
              <div className="text-sm leading-[1.6] sm:text-[14.5px]" style={{ color: INK_SOFT }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured coaches */}
      <section className="px-5 py-14 sm:px-10 sm:py-20 lg:px-24 lg:py-24">
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">Giáo viên &amp; Coach nổi bật</h2>
            <p className="mt-2.5 text-[14.5px] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
              Những người bán được học viên đánh giá cao nhất trên {brand.name}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-[14.5px] font-semibold sm:flex" style={{ color: BLUE }}>
            Xem tất cả <IconArrow className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[26px]">
          {COACHES.map((c) => (
            <div key={c.name} className="flex flex-col items-center gap-2.5 rounded-3xl border bg-white p-6 text-center sm:p-[26px]" style={{ borderColor: LINE }}>
              <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full sm:h-[72px] sm:w-[72px]" style={{ background: c.bg }}>
                <span className="font-[family-name:var(--font-serif)] text-xl font-bold text-white sm:text-[22px]">{c.initials}</span>
              </div>
              <div className="text-[16px] font-bold sm:text-[16.5px]">{c.name}</div>
              <span className="rounded-full border px-3.5 py-1 text-[12.5px]" style={{ borderColor: LINE, color: INK_SOFT }}>
                {c.subject}
              </span>
              <div className="flex items-center gap-1.5 text-[13.5px] font-semibold" style={{ color: AMBER }}>
                <IconStar className="h-3.5 w-3.5" /> {c.rating} <span className="font-medium" style={{ color: INK_SOFT }}>({c.reviews} đánh giá)</span>
              </div>
              <div className="text-[13px]" style={{ color: INK_SOFT }}>
                {c.sold}
              </div>
              <span className="mt-2 w-full rounded-full border px-4 py-2.5 text-[13.5px] font-semibold" style={{ borderColor: LINE }}>
                Xem gian hàng
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured documents */}
      <section className="px-5 py-14 sm:px-10 sm:py-20 lg:px-24 lg:py-24" style={{ background: PAPER_ALT }}>
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-[family-name:var(--font-serif)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">Tài liệu nổi bật</h2>
            <p className="mt-2.5 text-[14.5px] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
              Được học viên tin dùng và đánh giá cao nhất tuần này
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-[14.5px] font-semibold sm:flex" style={{ color: BLUE }}>
            Khám phá thêm <IconArrow className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {DOCS.map((d) => (
            <div key={d.title} className="overflow-hidden rounded-3xl border bg-white" style={{ borderColor: LINE }}>
              <div className="relative flex h-[160px] items-center justify-center sm:h-[176px]" style={{ background: d.coverBg, color: d.coverFg }}>
                <span className="absolute top-4 left-4 rounded-full bg-white px-3 py-1 text-xs font-bold" style={{ color: d.tagFg }}>
                  {d.tag}
                </span>
                <IconDocs className="h-12 w-12 sm:h-14 sm:w-14" />
              </div>
              <div className="p-5 sm:p-[22px]">
                <div className="mb-3.5 text-[15px] leading-[1.4] font-bold sm:text-base">{d.title}</div>
                <div className="mb-2.5 flex items-center gap-2">
                  <div className="h-[22px] w-[22px] rounded-full" style={{ background: d.sellerColor }} />
                  <span className="text-[13.5px]" style={{ color: INK_SOFT }}>
                    {d.seller}
                  </span>
                </div>
                <div className="mb-4 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: AMBER }}>
                  <IconStar className="h-[13px] w-[13px]" /> {d.rating} <span className="font-medium" style={{ color: INK_SOFT }}>· {d.sold}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-serif)] text-[17px] font-bold sm:text-[18px]" style={{ color: BLUE }}>
                    {d.price}
                  </span>
                  <span className="rounded-full border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: LINE }}>
                    Xem chi tiết
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Become a seller */}
      <section className="px-5 py-14 sm:px-10 sm:py-20 lg:px-24 lg:py-24">
        <div
          className="flex flex-col gap-10 rounded-[32px] p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:p-16"
          style={{ background: `linear-gradient(120deg, ${BLUE_DEEP} 0%, #0E1E48 100%)` }}
        >
          <div className="lg:w-[600px]">
            <span className="text-[12.5px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_SOFT }}>
              DÀNH CHO NGƯỜI DẠY HỌC
            </span>
            <h2 className="mt-3.5 font-[family-name:var(--font-serif)] text-2xl leading-[1.35] font-semibold text-white sm:text-[28px] lg:text-[32px] lg:leading-[1.3]">
              Bạn là giáo viên, coach hay chuyên gia?{" "}
              <span style={{ color: "#F4C979" }}>Mở gian hàng trên {brand.name} ngay hôm nay.</span>
            </h2>
            <div className="my-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-4 lg:my-[30px]">
              {["Miễn phí trọn đời với gói Free", "Không giới hạn sáng tạo nội dung", "Thanh toán an toàn, minh bạch", "Quản lý đơn hàng & khách hàng dễ dàng"].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-white/85 sm:text-[14.5px]">
                  <IconCheck className="h-4 w-4 shrink-0" style={{ color: "#F4C979" }} /> {item}
                </div>
              ))}
            </div>
            <Link href="/register" className="inline-block rounded-full px-[30px] py-[15px] text-[15px] font-bold sm:text-base" style={{ background: AMBER, color: "#241503" }}>
              Đăng ký làm người bán
            </Link>
          </div>
          <div className="relative hidden h-[300px] w-[320px] shrink-0 sm:block">
            <div className="absolute top-0 right-0 h-[220px] w-[220px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div
              className="absolute top-10 left-5 w-[260px] rotate-3 rounded-2xl p-[22px]"
              style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 24px 50px rgba(0,0,0,0.35)" }}
            >
              <div className="mb-2.5 h-2.5 w-[85%] rounded-full" style={{ background: LINE }} />
              <div className="mb-2.5 h-2.5 w-[65%] rounded-full" style={{ background: LINE }} />
              <div className="mb-4 h-2.5 w-[75%] rounded-full" style={{ background: LINE }} />
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold" style={{ color: AMBER }}>
                  149.000đ
                </span>
                <Stars />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="flex flex-col items-center px-5 py-14 sm:px-10 sm:py-20 lg:px-24 lg:py-24">
        <h2 className="font-[family-name:var(--font-serif)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">Người dùng nói gì về {brand.name}</h2>
        <p className="mt-3 mb-9 text-center text-[14.5px] sm:text-[15.5px] lg:mb-11" style={{ color: INK_SOFT }}>
          Những chia sẻ thật từ cộng đồng giáo viên và coach đang bán hàng trên nền tảng
        </p>
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
              <Stars className="mb-4" />
              <p className="mb-5 text-sm leading-[1.65] italic sm:text-[15px]" style={{ color: INK_SOFT }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 border-t pt-4 sm:pt-[18px]" style={{ borderColor: LINE }}>
                <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: t.bg }} />
                <div>
                  <div className="text-sm font-bold sm:text-[14.5px]">{t.name}</div>
                  <div className="text-xs sm:text-[13px]" style={{ color: INK_SOFT }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="flex flex-col items-center gap-5 px-5 py-14 text-center sm:px-10 sm:py-[76px] lg:px-24" style={{ background: AMBER }}>
        <h2 className="font-[family-name:var(--font-serif)] text-2xl font-semibold sm:text-[28px] lg:text-[32px]" style={{ color: "#241503" }}>
          Sẵn sàng gieo những hạt giống tri thức đầu tiên?
        </h2>
        <p className="text-sm sm:text-base" style={{ color: "#4A3006" }}>
          Mở gian hàng miễn phí trong 5 phút — không cần thẻ tín dụng.
        </p>
        <Link href="/register" className="mt-1.5 w-full rounded-full px-[30px] py-[15px] text-center text-[15px] font-bold text-white sm:w-auto sm:text-base" style={{ background: BLUE }}>
          Bắt đầu miễn phí ngay
        </Link>
      </section>

      {/* Footer */}
      <footer className="flex flex-col gap-10 px-5 pt-12 pb-8 sm:px-10 sm:pt-16 lg:gap-12 lg:px-24 lg:pt-[72px] lg:pb-10" style={{ background: BLUE_DEEP }}>
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="sm:w-[280px] lg:w-[320px]">
            <div className="mb-3.5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: "rgba(255,255,255,0.12)" }}>
                <span className="font-[family-name:var(--font-serif)] text-base font-bold text-white">G</span>
              </div>
              <span className="font-[family-name:var(--font-serif)] text-lg font-bold text-white">{brand.name}</span>
            </div>
            <p className="text-sm leading-[1.6] text-white/55">{brand.slogan}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Khám phá</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Tài liệu</span>
                <span>Giáo viên &amp; Coach</span>
                <Link href="/pricing">Bảng giá</Link>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Công ty</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Về {brand.name}</span>
                <span>Liên hệ</span>
                <span>Tuyển dụng</span>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Pháp lý</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Điều khoản dịch vụ</span>
                <span>Chính sách bảo mật</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-6 text-xs text-white/45 sm:pt-[26px]" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          © 2026 {brand.name}. Bảo lưu mọi quyền.
        </div>
      </footer>
    </div>
  );
}
