"use client";

import { useActionState, useState, useTransition } from "react";
import { ImageUploadField } from "../../_ui/image-upload-field";
import { PrimaryButton, TextField } from "../../_ui/kit";
import { isValidHex } from "../../../../lib/color-utils";
import { resetBrandingAction, saveColorsAction, saveLogoUrlAction, saveNameSloganAction, type BrandingActionState } from "./actions";

const TABS = [
  { id: "logo", label: "Logo & Icon" },
  { id: "favicon", label: "Favicon & OG" },
  { id: "name", label: "Tên & Slogan" },
  { id: "colors", label: "Màu sắc" },
  { id: "preview", label: "Xem trước" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface BrandingInitial {
  logoLightUrl: string;
  logoDarkUrl: string;
  logoSquareUrl: string;
  logoSidebarUrl: string;
  logoFooterUrl: string;
  faviconUrl: string;
  ogImageUrl: string;
  brandName: string;
  brandSlogan: string;
  envBrandName: string;
  envBrandSlogan: string;
  navbarLogoHeightPx: number;
  primaryColorHex: string;
  accentColorHex: string;
  secondaryColorHex: string;
}

function LogoField({ field, label, hint, value }: { field: string; label: string; hint: string; value: string }) {
  const [url, setUrl] = useState(value);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    setUrl(next);
    startTransition(async () => {
      await saveLogoUrlAction(field, next || null);
    });
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "#E5E7EB", opacity: isPending ? 0.7 : 1 }}>
      <ImageUploadField label={label} hint={hint} value={url} onChange={handleChange} previewClassName="w-56" />
    </div>
  );
}

export function BrandingEditor({ initial }: { initial: BrandingInitial }) {
  const [tab, setTab] = useState<TabId>("logo");

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: "#E5E7EB" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="rounded-t-lg px-4 py-2.5 text-sm font-semibold transition"
            style={
              tab === t.id
                ? { borderBottom: "2px solid #0F3B82", color: "#0F3B82" }
                : { borderBottom: "2px solid transparent", color: "#6B7280" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
        {tab === "logo" ? (
          <div className="space-y-5">
            <div>
              <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
                Logo & App Icon
              </p>
              <p className="text-sm text-gray-500">Logo chính xuất hiện trong header, trang đăng nhập. App icon dùng cho favicon dự phòng và không gian nhỏ.</p>
            </div>
            <LogoField field="logoLightUrl" label="Logo (nền sáng)" hint="PNG/SVG trong suốt — dùng trên nền sáng: header, trang đăng nhập." value={initial.logoLightUrl} />
            <LogoField field="logoDarkUrl" label="Logo (nền tối)" hint="Dùng trên nền tối: sidebar, footer — nếu không có sẽ dùng cho cả 2 mục dưới." value={initial.logoDarkUrl} />
            <LogoField field="logoSquareUrl" label="App icon / Logo mark (vuông)" hint="Tỷ lệ 1:1, khuyến nghị 256×256px." value={initial.logoSquareUrl} />
            <LogoField field="logoSidebarUrl" label="Logo sidebar admin (tuỳ chọn)" hint="Để trống sẽ dùng Logo (nền tối)." value={initial.logoSidebarUrl} />
            <LogoField field="logoFooterUrl" label="Logo footer (tuỳ chọn)" hint="Để trống sẽ dùng Logo (nền tối)." value={initial.logoFooterUrl} />
          </div>
        ) : null}

        {tab === "favicon" ? (
          <div className="space-y-5">
            <div>
              <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
                Favicon & Social Share
              </p>
              <p className="text-sm text-gray-500">Favicon hiển thị trên tab trình duyệt. OG Image xuất hiện khi chia sẻ link lên mạng xã hội.</p>
            </div>
            <LogoField field="faviconUrl" label="Favicon" hint="PNG 1:1, khuyến nghị 64×64 hoặc 256×256px." value={initial.faviconUrl} />
            <LogoField field="ogImageUrl" label="OG Image (mạng xã hội)" hint="PNG/JPG 1200×630 — hiển thị khi chia sẻ link lên Facebook, Zalo, Twitter." value={initial.ogImageUrl} />
          </div>
        ) : null}

        {tab === "name" ? <NameSloganForm initial={initial} /> : null}
        {tab === "colors" ? <ColorsForm initial={initial} /> : null}
        {tab === "preview" ? <PreviewTab initial={initial} /> : null}
      </div>
    </div>
  );
}

function NameSloganForm({ initial }: { initial: BrandingInitial }) {
  const [state, formAction, isPending] = useActionState<BrandingActionState, FormData>(saveNameSloganAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
          Tên & Slogan
        </p>
        <p className="text-sm text-gray-500">Xuất hiện trong title trang, metadata, và các vị trí logo dạng chữ. Để trống sẽ dùng giá trị cấu hình mặc định.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="brandName" name="brandName" label="Tên thương hiệu" defaultValue={initial.brandName} placeholder={initial.envBrandName} hint={`Mặc định: ${initial.envBrandName}`} />
        <TextField id="brandSlogan" name="brandSlogan" label="Slogan" defaultValue={initial.brandSlogan} placeholder={initial.envBrandSlogan} hint={`Mặc định: ${initial.envBrandSlogan}`} />
      </div>
      <div>
        <label htmlFor="navbarLogoHeightPx" className="block text-sm font-medium" style={{ color: "#12213A" }}>
          Kích thước logo trên navbar
        </label>
        <input
          id="navbarLogoHeightPx"
          name="navbarLogoHeightPx"
          type="range"
          min={24}
          max={80}
          defaultValue={initial.navbarLogoHeightPx}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-xs text-gray-500">Khuyến nghị 36–56px.</p>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
      <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu tên & slogan"}</PrimaryButton>
    </form>
  );
}

function ColorsForm({ initial }: { initial: BrandingInitial }) {
  const [state, formAction, isPending] = useActionState<BrandingActionState, FormData>(saveColorsAction, {});
  const [primary, setPrimary] = useState(initial.primaryColorHex);
  const [accent, setAccent] = useState(initial.accentColorHex);
  const [secondary, setSecondary] = useState(initial.secondaryColorHex);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
          Màu thương hiệu
        </p>
        <p className="text-sm text-gray-500">
          Áp dụng cho nút bấm, biểu tượng, thanh trạng thái... trên toàn bộ System Center, Studio, trang khách hàng. Hệ thống tự tính thêm sắc đậm
          hơn (gradient/hover) và nhạt hơn (nền nhãn) từ 2 màu Primary/Accent.
        </p>
      </div>

      <ColorField id="primaryColorHex" label="Primary — điều hướng, nút chính" value={primary} onChange={setPrimary} />
      <ColorField id="accentColorHex" label="Accent — CTA, điểm nhấn" value={accent} onChange={setAccent} />
      <ColorField id="secondaryColorHex" label="Secondary — thành công, tăng trưởng" value={secondary} onChange={setSecondary} />

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Đã lưu — tải lại trang để thấy màu mới.</p> : null}
      <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu màu thương hiệu"}</PrimaryButton>
    </form>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = value === "" || isValidHex(value);
  return (
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 shrink-0 rounded-lg border" style={{ background: valid && value ? value : "#E5E7EB", borderColor: "#E5E7EB" }} />
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium" style={{ color: "#12213A" }}>
          {label}
        </label>
        <input
          id={id}
          name={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0F3B82"
          className="mt-1 w-full max-w-[160px] rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
          style={{ borderColor: valid ? "#E5E7EB" : "#DC2626" }}
        />
      </div>
    </div>
  );
}

function PreviewTab({ initial }: { initial: BrandingInitial }) {
  const sidebarLogo = initial.logoSidebarUrl || initial.logoDarkUrl;
  const footerLogo = initial.logoFooterUrl || initial.logoDarkUrl;

  return (
    <div>
      <p className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
        Xem trước — vị trí xuất hiện
      </p>
      <p className="mb-5 text-sm text-gray-500">Preview logo trong các vị trí thực tế trên hệ thống.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PreviewCard label="Trang đăng nhập" bg="white">
          <LogoOrFallback url={initial.logoLightUrl} name={initial.brandName || initial.envBrandName} dark={false} />
        </PreviewCard>
        <PreviewCard label="Admin sidebar" bg="#0F3B82">
          <LogoOrFallback url={sidebarLogo} name={initial.brandName || initial.envBrandName} dark />
        </PreviewCard>
        <PreviewCard label="Tab trình duyệt (favicon)" bg="white">
          {initial.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initial.faviconUrl} alt="" className="h-6 w-6" />
          ) : (
            <span className="text-xs text-gray-400">Chưa cấu hình favicon</span>
          )}
        </PreviewCard>
        <PreviewCard label="Footer landing" bg="#12213A">
          <LogoOrFallback url={footerLogo} name={initial.brandName || initial.envBrandName} dark />
        </PreviewCard>
      </div>
    </div>
  );
}

function PreviewCard({ label, bg, children }: { label: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "#E5E7EB" }}>
      <div className="border-b px-3 py-2 text-xs font-medium text-gray-500" style={{ borderColor: "#E5E7EB" }}>
        {label}
      </div>
      <div className="flex h-20 items-center justify-center px-4" style={{ background: bg }}>
        {children}
      </div>
    </div>
  );
}

function LogoOrFallback({ url, name, dark }: { url: string; name: string; dark: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="max-h-10 max-w-full object-contain" />;
  }
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
        style={{ background: dark ? "rgba(255,255,255,0.15)" : "#0F3B82", color: "white" }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="text-sm font-bold" style={{ color: dark ? "white" : "#12213A" }}>
        {name}
      </span>
    </div>
  );
}

export function ResetBrandingButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await resetBrandingAction();
        })
      }
      className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
      style={{ borderColor: "#E5E7EB", color: "#12213A" }}
    >
      {isPending ? "Đang làm mới..." : "Làm mới (xoá hết tuỳ biến)"}
    </button>
  );
}
