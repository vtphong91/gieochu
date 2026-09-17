import { getBrand } from "@gieochu/config/brand";

export default function HomePage() {
  const brand = getBrand();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold text-[var(--color-primary)]">{brand.name}</h1>
      <p className="text-lg text-gray-600">{brand.slogan}</p>
      <p className="text-sm text-gray-400">
        Nền móng dự án (M0) đã sẵn sàng. Các trang đăng ký, đăng nhập và trang giới thiệu đầy đủ sẽ
        đến trong M1 và M2.
      </p>
    </main>
  );
}
