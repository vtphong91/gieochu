import type { Metadata } from "next";
import { getBrand } from "@gieochu/config/brand";
import "./globals.css";

export function generateMetadata(): Metadata {
  const brand = getBrand();
  return {
    title: brand.name,
    description: brand.slogan,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
