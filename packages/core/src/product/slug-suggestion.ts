/** §"M5": when `base` is already taken within the tenant, suggest `base-2`, `base-3`, ... */
export function suggestSlug(base: string, takenSlugs: Iterable<string>): string {
  const taken = new Set(takenSlugs);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
