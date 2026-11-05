import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  const needsSsl = !/localhost|127\.0\.0\.1/.test(url) && process.env.DATABASE_SSL !== "false";
  const p = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  // Idle-client errors would otherwise crash the process. Log the message only (never the URL/credentials).
  p.on("error", (err) => console.error("Postgres pool error:", err.message));
  return p;
}

export function pool(): Pool {
  if (!global.__pgPool) global.__pgPool = makePool();
  return global.__pgPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** All date bucketing is done in IST so "today" means today at Delhi Airport. */
const tzEnv = process.env.APP_TIMEZONE || "Asia/Kolkata";
export const TZ = /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(tzEnv) ? tzEnv : "Asia/Kolkata";
