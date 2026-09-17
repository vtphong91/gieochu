import { requireVerifiedAccess } from "../../../lib/page-guards";
import { changePasswordAction, logoutAllDevicesAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Vui lòng điền đầy đủ các trường.",
  wrong_password: "Mật khẩu hiện tại không đúng.",
  weak_password: "Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ và số.",
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireVerifiedAccess("/account/security");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Bảo mật tài khoản</h1>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
        <form action={changePasswordAction} className="mt-3 space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="currentPassword">
              Mật khẩu hiện tại
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="newPassword">
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          {params.error ? <p className="text-sm text-red-600">{ERROR_MESSAGES[params.error] ?? "Có lỗi xảy ra."}</p> : null}
          {params.success === "password_changed" ? (
            <p className="text-sm text-green-700">Đổi mật khẩu thành công.</p>
          ) : null}
          <button type="submit" className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white">
            Đổi mật khẩu
          </button>
        </form>
      </section>

      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold">Phiên đăng nhập</h2>
        <p className="mt-2 text-sm text-gray-600">Đăng xuất khỏi tất cả thiết bị đang đăng nhập.</p>
        <form action={logoutAllDevicesAction} className="mt-3">
          <button type="submit" className="w-full rounded border border-red-600 px-4 py-2 text-red-600">
            Đăng xuất mọi thiết bị
          </button>
        </form>
      </section>
    </main>
  );
}
