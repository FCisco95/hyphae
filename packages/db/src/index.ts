import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Driver-agnostic handle: postgres-js in production, PGlite in tests, and any transaction of either.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbConnectionTarget {
  host: string;
  port: number;
  database: string;
  ssl?: "verify-full";
}

export function createDb(url: string, target?: DbConnectionTarget) {
  // Setup callers pin reviewed fields explicitly so URL parsing or ambient PG* variables
  // cannot select another target. Existing runtime callers retain their existing options.
  const client = postgres(url, { ...target, max: 10, prepare: false }); // prepare:false — Neon's pooler is transaction-mode
  return drizzle({ client, schema });
}

export * from "./schema.js";
export { schema };
