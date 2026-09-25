import type { Db } from "@hyphae/db";
import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Postgres keeps microseconds; a JS Date would drop them (A3).
export const isoUs = (column: AnyPgColumn | SQL) =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

// One consistent view without row locks.
export const readOnly = <T>(db: Db, fn: (tx: Db) => Promise<T>) =>
  db.transaction(fn, { isolationLevel: "repeatable read", accessMode: "read only" });
