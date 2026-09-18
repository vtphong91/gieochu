// §"M5 — Sản phẩm và File tài liệu". The S3 client / presign helpers
// (network calls against R2/MinIO) are intentionally not built yet — this
// session builds the format/key logic that doesn't need live storage; see
// docs/BACKLOG.md for the deferred upload/presign half of this module.
export { ALLOWED_EXTENSIONS, getDeclaredExtension, isAllowedExtension, matchesDeclaredExtension } from "./file-format";
export type { AllowedExtension } from "./file-format";

export { buildProductFileKey, sanitizeFileName } from "./object-key";
