/** Parses env-style durations like "15m", "24h", "30d" into seconds. */
export function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${input}" (expected e.g. "15m", "24h", "7d")`);
  }
  const [, amount, unit] = match;
  const value = Number(amount);

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Invalid duration unit: "${unit}"`);
  }
}
