/**
 * Utilities to assemble connection strings and URLs from granular environment variables.
 * Enables configuring individual components (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT,
 * APP_HOST, APP_PORT, etc.) instead of monolithic connection strings.
 */

export interface PostgresUrlParams {
  host?: string;
  port?: string | number;
  database?: string;
  user?: string;
  password?: string;
  sslmode?: string;
}

export interface AppUrlParams {
  host?: string;
  port?: string | number;
  protocol?: string;
}

/**
 * Derives a pooled Neon hostname from a direct Neon hostname.
 * Neon convention: insert "-pooler" before the first dot if hostname matches *.neon.tech
 * and does not already contain "-pooler".
 * For non-Neon hosts or hosts already containing "-pooler", returns the hostname unchanged.
 */
export function derivePooledHost(directHost: string): string {
  const trimmed = directHost.trim();
  if (trimmed.includes(".neon.tech") && !trimmed.includes("-pooler")) {
    return trimmed.replace(/^([^.]+)\./, "$1-pooler.");
  }
  return trimmed;
}

/**
 * Builds a PostgreSQL connection string from components.
 * Returns undefined if any required component (host, database, user, password) is missing.
 * Encodes user and password properly to avoid breaking URLs when special characters are used.
 */
export function buildPostgresUrl(params: PostgresUrlParams): string | undefined {
  const host = params.host?.trim();
  const database = params.database?.trim();
  const user = params.user?.trim();
  const password = params.password;

  if (!host || !database || !user || password === undefined || password === "") {
    return undefined;
  }

  const port = params.port ? String(params.port).trim() : "5432";
  const sslmode = params.sslmode?.trim() || "require";
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}?sslmode=${sslmode}`;
}

/**
 * Builds an APP_URL string from host, port, and protocol.
 * Returns undefined if host is missing.
 */
export function buildAppUrl(params: AppUrlParams): string | undefined {
  let host = params.host?.trim();
  if (!host) return undefined;

  let protocol = params.protocol?.trim().toLowerCase();
  // Strip protocol if user included it in host
  if (host.startsWith("http://")) {
    protocol = protocol || "http";
    host = host.slice(7);
  } else if (host.startsWith("https://")) {
    protocol = protocol || "https";
    host = host.slice(8);
  }

  // Strip trailing slashes or path
  host = host.replace(/\/.*$/, "");

  // Default protocol: http for localhost/local IPs or if port is 80; https otherwise
  if (!protocol) {
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      params.port === "3000" ||
      params.port === 3000 ||
      params.port === "80" ||
      params.port === 80
    ) {
      protocol = "http";
    } else {
      protocol = "https";
    }
  }

  let port = params.port ? String(params.port).trim() : undefined;
  // If host already has port (e.g. localhost:3000), extract it
  if (host.includes(":")) {
    const parts = host.split(":");
    host = parts[0];
    port = port || parts[1];
  }

  // Omit standard ports
  let portSuffix = "";
  if (port) {
    if (!((protocol === "http" && port === "80") || (protocol === "https" && port === "443"))) {
      portSuffix = `:${port}`;
    }
  }

  return `${protocol}://${host}${portSuffix}`;
}

/**
 * Resolves PRISMA_MIGRATE_URL from PRISMA_MIGRATE_URL or granular owner credentials.
 */
export function resolvePrismaMigrateUrl(env: Record<string, string | undefined>): string | undefined {
  const direct = env.PRISMA_MIGRATE_URL?.trim();
  if (direct) return direct;

  return buildPostgresUrl({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_MIGRATE_USER,
    password: env.DB_MIGRATE_PASSWORD,
    sslmode: env.DB_SSLMODE,
  });
}

/**
 * Resolves DATABASE_URL and DIRECT_URL from an environment record.
 */
export function resolveDatabaseUrls(env: Record<string, string | undefined>): {
  databaseUrl?: string;
  directUrl?: string;
} {
  const directUrl =
    env.DIRECT_URL?.trim() ||
    buildPostgresUrl({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      sslmode: env.DB_SSLMODE,
    });

  const pooledHost = env.DB_POOLED_HOST?.trim() || (env.DB_HOST ? derivePooledHost(env.DB_HOST) : undefined);
  const pooledPort = env.DB_POOLED_PORT || env.DB_PORT;
  const databaseUrl =
    env.DATABASE_URL?.trim() ||
    buildPostgresUrl({
      host: pooledHost,
      port: pooledPort,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      sslmode: env.DB_SSLMODE,
    });

  return { databaseUrl, directUrl };
}

/**
 * Resolves raw environment by populating DATABASE_URL, DIRECT_URL, APP_URL,
 * and TEST_DATABASE_URL from granular variables if not already explicitly provided.
 */
export function resolveRawEnv(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = { ...raw };

  // 1. Resolve APP_URL
  if (!result.APP_URL?.trim()) {
    const assembledAppUrl = buildAppUrl({
      host: result.APP_HOST,
      port: result.APP_PORT,
      protocol: result.APP_PROTOCOL,
    });
    if (assembledAppUrl) {
      result.APP_URL = assembledAppUrl;
    }
  }

  // 2. Resolve DIRECT_URL (Direct Postgres host)
  if (!result.DIRECT_URL?.trim()) {
    const assembledDirect = buildPostgresUrl({
      host: result.DB_HOST,
      port: result.DB_PORT,
      database: result.DB_NAME,
      user: result.DB_USER,
      password: result.DB_PASSWORD,
      sslmode: result.DB_SSLMODE,
    });
    if (assembledDirect) {
      result.DIRECT_URL = assembledDirect;
    }
  }

  // 3. Resolve DATABASE_URL (Pooled host if specified or derived, else direct host)
  if (!result.DATABASE_URL?.trim()) {
    const pooledHost = result.DB_POOLED_HOST?.trim() || (result.DB_HOST ? derivePooledHost(result.DB_HOST) : undefined);
    const pooledPort = result.DB_POOLED_PORT || result.DB_PORT;
    const assembledDatabase = buildPostgresUrl({
      host: pooledHost,
      port: pooledPort,
      database: result.DB_NAME,
      user: result.DB_USER,
      password: result.DB_PASSWORD,
      sslmode: result.DB_SSLMODE,
    });
    if (assembledDatabase) {
      result.DATABASE_URL = assembledDatabase;
    }
  }

  // 4. Resolve TEST_DATABASE_URL
  if (!result.TEST_DATABASE_URL?.trim() && result.TEST_DB_NAME?.trim()) {
    const assembledTestDb = buildPostgresUrl({
      host: result.DB_HOST,
      port: result.DB_PORT,
      database: result.TEST_DB_NAME,
      user: result.DB_USER,
      password: result.DB_PASSWORD,
      sslmode: result.DB_SSLMODE,
    });
    if (assembledTestDb) {
      result.TEST_DATABASE_URL = assembledTestDb;
    }
  }

  return result;
}
