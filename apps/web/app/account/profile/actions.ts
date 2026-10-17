"use server";

import { revalidatePath } from "next/cache";
import {
  createAvatarUploadSignature,
  removeAvatar,
  saveAvatar,
  updateProfile,
  type SaveAvatarState,
  type UpdateProfileState,
} from "../../../lib/account-profile";
import { accountErrorState, type AccountActionState } from "../../../lib/account-state";
import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../../lib/cloudinary-signature";
import { requireVerified } from "../../../lib/session";

/**
 * ADR-041 C2 — lưu hồ sơ (`useActionState`): `fullName` (1–80, bắt buộc), `phone?`, `province?` (tuỳ chọn).
 * Lỗi theo ô ở `fieldErrors`; giá trị đã gõ ở `values` khi lỗi.
 */
export async function updateProfileAction(_prev: UpdateProfileState, formData: FormData): Promise<UpdateProfileState> {
  try {
    const user = await requireVerified();
    const state = await updateProfile(user, formData);
    if (state?.ok) revalidatePath("/account", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "updateProfileAction");
  }
}

/**
 * ADR-041 C6 — chữ ký upload ảnh đại diện (Cloudinary hệ thống, `users/<userId>/avatar/<hex>`, png/jpeg/webp,
 * incoming `c_limit,w_1024,h_1024`). Cùng contract `CloudinarySignatureResult` với `ImageUploadField`
 * (`errorCode`: `CLOUDINARY_NOT_CONFIGURED` | `RATE_LIMITED` | `UNAUTHORIZED` | `FORBIDDEN`). Không tính hạn mức gói.
 */
export async function getAvatarUploadSignatureAction(): Promise<CloudinarySignatureResult> {
  try {
    const user = await requireVerified();
    return signatureOk(await createAvatarUploadSignature(user.userId));
  } catch (error) {
    return signatureError(error);
  }
}

/** ADR-041 C6 — ghi nhận ảnh vừa upload (`publicId` từ chữ ký) → `{ ok, message, avatarUrl }`. */
export async function saveAvatarAction(publicId: string): Promise<SaveAvatarState> {
  try {
    const user = await requireVerified();
    const state = await saveAvatar(user.userId, publicId);
    if (state?.ok) revalidatePath("/", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "saveAvatarAction");
  }
}

/** ADR-041 C6 — gỡ ảnh đại diện (`avatarKey = null`). */
export async function removeAvatarAction(): Promise<AccountActionState> {
  try {
    const user = await requireVerified();
    const state = await removeAvatar(user.userId);
    revalidatePath("/", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "removeAvatarAction");
  }
}
