import { Suspense } from "react";
import { getEffectiveBrand } from "../../../lib/branding";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const brand = await getEffectiveBrand();
  return (
    // useSearchParams() trong form cần ranh giới Suspense.
    <Suspense fallback={null}>
      <LoginForm brandName={brand.name} />
    </Suspense>
  );
}
