/** §"M5" allowlist: `pdf, docx, doc, pptx, ppt, xlsx, xls, zip, png, jpg, jpeg, mp4`. */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "docx",
  "doc",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "mp4",
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/**
 * What the `file-type` package (magic-byte sniffing) may report for each
 * allowed extension. Legacy OLE formats (doc/ppt/xls) all share the same
 * Compound File Binary signature and can't be told apart from bytes alone,
 * so any of the three is accepted for any of the three declared extensions.
 */
const ACCEPTED_DETECTED_TYPES: Record<AllowedExtension, readonly string[]> = {
  pdf: ["pdf"],
  docx: ["docx"],
  doc: ["cfb", "doc", "ppt", "xls"],
  pptx: ["pptx"],
  ppt: ["cfb", "doc", "ppt", "xls"],
  xlsx: ["xlsx"],
  xls: ["cfb", "doc", "ppt", "xls"],
  zip: ["zip"],
  png: ["png"],
  jpg: ["jpg", "jpeg"],
  jpeg: ["jpg", "jpeg"],
  mp4: ["mp4"],
};

export function getDeclaredExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

export function isAllowedExtension(fileName: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(getDeclaredExtension(fileName));
}

/**
 * §"M5": "Kiểm tra cả phần mở rộng và magic bytes" — `detectedType` is what
 * reading the file's actual bytes (file.scan job, via `file-type`) found;
 * `undefined` means the format couldn't be identified at all (also rejected).
 */
export function matchesDeclaredExtension(fileName: string, detectedType: string | undefined): boolean {
  const declared = getDeclaredExtension(fileName);
  if (!isAllowedExtension(fileName) || !detectedType) return false;
  return ACCEPTED_DETECTED_TYPES[declared as AllowedExtension].includes(detectedType.toLowerCase());
}
