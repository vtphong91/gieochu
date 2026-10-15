import { getEffectiveBrand } from "../../../lib/branding";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const brand = await getEffectiveBrand();
  return <RegisterForm brandName={brand.name} />;
}
