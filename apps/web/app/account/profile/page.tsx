import { getPrismaClient } from "@gieochu/db";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { completeProfileAction } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const user = await requireVerifiedAccess("/account/profile");

  const prisma = getPrismaClient();
  const profile = await prisma.userProfile.findUnique({ where: { userId: user.userId } });

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Hồ sơ của bạn</h1>
      <p className="mt-2 text-sm text-gray-500">Cập nhật thông tin liên hệ — có thể sửa lại bất cứ lúc nào.</p>
      {params.error ? <p className="mt-2 text-sm text-red-600">Vui lòng điền đầy đủ các trường bắt buộc.</p> : null}

      <form action={completeProfileAction} className="mt-6 space-y-4">
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <div>
          <label className="block text-sm font-medium" htmlFor="fullName">
            Họ và tên
          </label>
          <input
            id="fullName"
            name="fullName"
            defaultValue={profile?.fullName ?? ""}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="phone">
            Số điện thoại
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={profile?.phone ?? ""}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="province">
            Tỉnh / Thành phố
          </label>
          <input
            id="province"
            name="province"
            defaultValue={profile?.province ?? ""}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white">
          Lưu hồ sơ
        </button>
      </form>
    </main>
  );
}
