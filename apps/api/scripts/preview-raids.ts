import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { serve } from "@hono/node-server";
import { createDb } from "@hyphae/db";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { readRoutes } from "../src/http/routes.js";
import { readOnly } from "../src/pg.js";

// Local preview only: no bot, worker, jobs, migrations, signer or private auth route.
let stage = "configuration";
async function main() {
  const local = new URL("../../../.env", import.meta.url);
  const values = existsSync(local)
    ? parseEnv(readFileSync(local, "utf8").replace(/^\uFEFF/, ""))
    : {};
  const url = process.env.DATABASE_URL || values.DATABASE_URL;
  if (!url) throw new Error("Missing read configuration");
  const db = createDb(url);
  stage = "read-only proof";
  // The pooler refuses session-default startup options. Keep the recorded DSN and
  // enforce read-only transactions for every proof, clock and raid query instead.
  const proof = await readOnly(db, (tx) => tx.execute(sql`show transaction_read_only`));
  const rows = (Array.isArray(proof) ? proof : (proof as { rows: unknown[] }).rows) as {
    transaction_read_only: string;
  }[];
  if (rows[0]?.transaction_read_only !== "on") {
    throw new Error("Read-only transaction not confirmed");
  }
  const reads = readRoutes({
    db,
    clock: () =>
      readOnly(db, async (tx) => {
        const result = await tx.execute(
          sql`select floor(extract(epoch from clock_timestamp()) * 1000)::double precision as ms`,
        );
        const clockRows = (
          Array.isArray(result) ? result : (result as { rows: unknown[] }).rows
        ) as { ms: number }[];
        if (clockRows[0]?.ms === undefined) throw new Error("Missing database clock");
        return new Date(Number(clockRows[0].ms));
      }),
  });
  const app = new Hono();
  app.get("/health", (c) => c.json({ ok: true, pid: process.pid, read_only: true }));
  app.get("/v1/communities/:mint/raids", (c) =>
    reads.fetch(
      new Request(
        new URL(`/communities/${encodeURIComponent(c.req.param("mint"))}/raids`, c.req.url),
        { headers: c.req.raw.headers },
      ),
    ),
  );
  serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3011 }, () => {
    console.log("Local read-only raid preview ready on loopback3011.");
  });
}
main().catch((error: unknown) => {
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : null;
  const causeCode =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string" &&
    /^[0-9A-Z]{5}$/.test(cause.code)
      ? cause.code
      : undefined;
  console.error(
    JSON.stringify({
      preview: "raids",
      stage,
      causeCode,
      error: error instanceof Error ? error.name : "unknown",
      code:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string" &&
        /^[0-9A-Z]{5}$/.test(error.code)
          ? error.code
          : undefined,
    }),
  );
  console.error("Read-only raid preview could not start. Check local read configuration.");
  process.exit(1);
});
