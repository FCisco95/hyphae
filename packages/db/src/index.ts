import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false }); // prepare:false — Neon's pooler is transaction-mode
  return drizzle({ client, schema });
}

export * from "./schema.js";
export { schema };
