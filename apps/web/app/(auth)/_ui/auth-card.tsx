import type { ReactNode } from "react";
import { INK, INK_SOFT, LINE } from "./colors";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: LINE }}>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-semibold" style={{ color: INK }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm" style={{ color: INK_SOFT }}>
            {subtitle}
          </p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? (
        <p className="mt-5 text-center text-sm" style={{ color: INK_SOFT }}>
          {footer}
        </p>
      ) : null}
    </div>
  );
}
