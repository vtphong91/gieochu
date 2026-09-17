import path from "node:path";
import { config as loadEnv } from "dotenv";

// Vitest does not auto-load dotenv; the monorepo keeps a single root .env
// (see packages/db/prisma.config.ts and next.config.ts for the same pattern).
// Vitest's cwd for this package is apps/web, so root is two levels up.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });
